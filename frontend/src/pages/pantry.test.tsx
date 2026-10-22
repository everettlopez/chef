import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, formatShortDate, todayISO } from '../lib/format'
import { db, ingredients, pantryItem, requestsTo } from '../test/db'
import { renderApp } from '../test/render'

afterEach(() => vi.useRealTimers())

describe('PantryPage', () => {
  it('has an empty state that opens the add sheet', async () => {
    const { user } = renderApp('/pantry')

    await user.click(await screen.findByRole('button', { name: 'Add your first item' }))

    expect(screen.getByRole('dialog', { name: 'Add to pantry' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Ingredient' })).toHaveFocus()
  })

  it('groups items by expiry with an icon and text on every badge', async () => {
    const today = todayISO()
    db.pantry = [
      pantryItem({ id: 1, ingredient: ingredients.milk, expires_on: addDays(today, -2) }),
      pantryItem({ id: 2, ingredient: ingredients.spinach, expires_on: addDays(today, 1) }),
      pantryItem({
        id: 3,
        ingredient: ingredients.rice,
        expires_on: addDays(today, 30),
        expiry_estimated: false,
        quantity: 2,
        unit: 'cup',
        storage: 'pantry',
      }),
      pantryItem({ id: 4, ingredient: ingredients.egg, expires_on: null }),
    ]
    renderApp('/pantry')

    expect(await screen.findByText('4 items shared with your household')).toBeInTheDocument()
    const sections = ['Expired · 1', 'Use soon · 1', 'Fresh · 1', 'No date · 1']
    for (const name of sections) expect(screen.getByRole('heading', { name })).toBeInTheDocument()

    const expired = screen.getByRole('heading', { name: 'Expired · 1' }).closest('section')!
    expect(expired).toHaveTextContent('Milk')
    expect(
      within(expired)
        .getAllByText(/Expired 2 days ago/)[0]
        .querySelector('svg'),
    ).not.toBeNull()

    const fresh = screen.getByRole('heading', { name: 'Fresh · 1' }).closest('section')!
    expect(fresh).toHaveTextContent('2 cup')
    expect(fresh).not.toHaveTextContent('est.') // a date the user set
    expect(
      screen.getByRole('heading', { name: 'Use soon · 1' }).closest('section'),
    ).toHaveTextContent('est.')
  })

  it('adds an autocompleted item with its default storage, unit and estimate', async () => {
    const { user } = renderApp('/pantry')
    await user.click(await screen.findByRole('button', { name: 'Add item' }))
    const sheet = screen.getByRole('dialog', { name: 'Add to pantry' })

    await user.type(within(sheet).getByRole('combobox'), 'spin')
    await user.click(await within(sheet).findByRole('option', { name: /Spinach/ }))

    expect(within(sheet).getByRole('radio', { name: 'Fridge' })).toBeChecked()
    expect(within(sheet).getByLabelText('Unit')).toHaveValue('cup')
    expect(within(sheet).getByLabelText('Expires on')).toHaveAccessibleDescription(
      `Leave blank to use the estimate: ${formatShortDate(addDays(todayISO(), 5))}.`,
    )
    await user.type(within(sheet).getByLabelText('Quantity'), '2')
    await user.click(within(sheet).getByRole('button', { name: 'Add to pantry' }))

    expect(await screen.findByText('Added Spinach to your pantry.')).toBeInTheDocument()
    expect(requestsTo('POST', '/pantry')[0].body).toEqual({
      ingredient_id: ingredients.spinach.id,
      quantity: 2,
      unit: 'cup',
      storage: 'fridge',
      expires_on: null,
    })
    expect(await screen.findByText('Spinach')).toBeInTheDocument()
  })

  it('sends free text and no unit when there is no quantity ("have some")', async () => {
    const { user } = renderApp('/pantry')
    await user.click(await screen.findByRole('button', { name: 'Add item' }))
    const sheet = screen.getByRole('dialog', { name: 'Add to pantry' })

    await user.type(within(sheet).getByRole('combobox'), 'Milk')
    await user.type(within(sheet).getByLabelText('Unit'), 'cup')
    await user.click(within(sheet).getByRole('button', { name: 'Add to pantry' }))

    await waitFor(() => expect(requestsTo('POST', '/pantry')).toHaveLength(1))
    expect(requestsTo('POST', '/pantry')[0].body).toMatchObject({
      name: 'Milk',
      quantity: null,
      unit: null,
    })
  })

  it('shows a validation error from the API', async () => {
    const { user } = renderApp('/pantry')
    await user.click(await screen.findByRole('button', { name: 'Add item' }))
    const sheet = screen.getByRole('dialog', { name: 'Add to pantry' })

    await user.type(within(sheet).getByRole('combobox'), 'zzz')
    await user.click(within(sheet).getByRole('button', { name: 'Add to pantry' }))

    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Unknown ingredient')
  })

  it('edits an item, going back to the estimate when the date is cleared', async () => {
    db.pantry = [
      pantryItem({
        id: 7,
        ingredient: ingredients.milk,
        quantity: 1,
        unit: 'gallon',
        expiry_estimated: false,
        expires_on: addDays(todayISO(), 9),
      }),
    ]
    const { user } = renderApp('/pantry')
    await user.click(await screen.findByRole('button', { name: /Milk/ }))
    const sheet = screen.getByRole('dialog', { name: 'Milk' })
    expect(within(sheet).getByLabelText('Expires on')).toHaveValue(addDays(todayISO(), 9))

    await user.clear(within(sheet).getByLabelText('Quantity'))
    await user.type(within(sheet).getByLabelText('Quantity'), '0.5')
    await user.click(within(sheet).getByRole('radio', { name: 'Freezer' }))
    await user.clear(within(sheet).getByLabelText('Expires on'))
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(requestsTo('PATCH', '/pantry/7')).toHaveLength(1))
    expect(requestsTo('PATCH', '/pantry/7')[0].body).toEqual({
      quantity: 0.5,
      unit: 'gallon',
      storage: 'freezer',
      use_estimate: true,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('discards an item and can undo it', async () => {
    db.pantry = [pantryItem({ id: 8, ingredient: ingredients.rice })]
    const { user } = renderApp('/pantry')
    await user.click(await screen.findByRole('button', { name: /Rice/ }))

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    const toast = await screen.findByText('Discarded Rice.')
    expect(await screen.findByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument()
    await user.click(within(toast.parentElement!).getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(requestsTo('PATCH', '/pantry/8').at(-1)?.body).toEqual({ status: 'active' }),
    )
    expect(await screen.findByRole('button', { name: /Rice/ })).toBeInTheDocument()
  })

  it('marks an item used up', async () => {
    db.pantry = [pantryItem({ id: 9, ingredient: ingredients.egg })]
    const { user } = renderApp('/pantry')
    await user.click(await screen.findByRole('button', { name: /Egg/ }))

    await user.click(screen.getByRole('button', { name: 'Used up' }))

    expect(await screen.findByText('Marked Egg as used up.')).toBeInTheDocument()
    expect(requestsTo('PATCH', '/pantry/9')[0].body).toEqual({ status: 'used' })
  })
})
