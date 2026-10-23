import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db, me, requestsTo, tags } from '../test/db'
import { renderApp } from '../test/render'

describe('HouseholdPage', () => {
  it('shows the invite code and members', async () => {
    db.household.members.push({
      user_id: 8,
      display_name: 'Ben',
      email: 'ben@example.com',
      role: 'member',
    })
    renderApp('/household')

    expect(await screen.findByRole('heading', { name: "Cook's Kitchen" })).toBeInTheDocument()
    expect(screen.getByLabelText('Invite code A B C D 2 3 4 5')).toHaveTextContent('ABCD2345')
    const members = screen.getByRole('heading', { name: 'Members · 2' }).closest('section')!
    const [cook, ben] = within(members).getAllByRole('listitem')
    expect(cook).toHaveTextContent('Cook (you)')
    expect(cook).toHaveTextContent('Owner')
    expect(ben).not.toHaveTextContent('(you)')
    expect(ben).not.toHaveTextContent('Owner')
  })

  it('copies the invite code', async () => {
    const { user } = renderApp('/household')
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')

    await user.click(await screen.findByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('ABCD2345')
    expect(await screen.findByText('Invite code copied.')).toBeInTheDocument()
  })

  it('shows the code in the toast when the clipboard is blocked', async () => {
    const { user } = renderApp('/household')
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))

    await user.click(await screen.findByRole('button', { name: 'Copy' }))

    expect(await screen.findByText('Invite code: ABCD2345')).toBeInTheDocument()
  })

  it('makes a new code', async () => {
    const { user } = renderApp('/household')

    await user.click(await screen.findByRole('button', { name: 'New code' }))

    expect(await screen.findByText('XYZW6789')).toBeInTheDocument()
  })

  it('renames the household', async () => {
    const { user } = renderApp('/household')
    await user.click(await screen.findByRole('button', { name: 'Rename' }))
    const field = screen.getByLabelText('Name')
    expect(field).toHaveFocus()

    await user.clear(field)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(field, '  Apartment 4B ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Apartment 4B' }),
    ).toBeInTheDocument()
    expect(requestsTo('PATCH', '/household')[0].body).toEqual({ name: 'Apartment 4B' })
  })

  it('joins another household, upper-casing the code', async () => {
    const { user } = renderApp('/household')
    await user.click(await screen.findByRole('button', { name: 'Join another household' }))
    const sheet = screen.getByRole('dialog', { name: 'Join a household' })

    await user.type(within(sheet).getByLabelText('Invite code'), 'friend22')
    expect(within(sheet).getByLabelText('Invite code')).toHaveValue('FRIEND22')
    await user.click(within(sheet).getByRole('button', { name: 'Join household' }))

    expect(await screen.findByText("Welcome to Friend's Flat!")).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { level: 1, name: "Friend's Flat" }),
    ).toBeInTheDocument()
  })

  it('reports an unknown code', async () => {
    const { user } = renderApp('/household')
    await user.click(await screen.findByRole('button', { name: 'Join another household' }))
    const sheet = screen.getByRole('dialog', { name: 'Join a household' })

    await user.type(within(sheet).getByLabelText('Invite code'), 'NOPE')
    await user.click(within(sheet).getByRole('button', { name: 'Join household' }))

    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'No household has that invite code',
    )
  })
})

describe('SettingsPage', () => {
  it('shows the account and splits diets from allergies', async () => {
    db.prefs = [{ tag: tags.nuts, mode: 'avoid' }]
    renderApp('/settings')

    const account = (await screen.findByRole('heading', { name: 'Account' })).closest('section')!
    expect(account).toHaveTextContent(me.email)
    const diet = (await screen.findByRole('heading', { name: 'Diet' })).closest('section')!
    const allergies = screen.getByRole('heading', { name: 'Allergies' }).closest('section')!
    expect(within(diet).getByRole('switch', { name: 'Vegetarian' })).not.toBeChecked()
    expect(within(allergies).getByRole('switch', { name: 'Avoid nuts' })).toBeChecked()
  })

  it('saves a toggle', async () => {
    const { user } = renderApp('/settings')

    await user.click(await screen.findByRole('switch', { name: 'Vegan' }))

    expect(screen.getByRole('switch', { name: 'Vegan' })).toBeChecked()
    await waitFor(() => expect(db.prefs.map((p) => p.tag.name)).toEqual(['vegan']))
  })

  it('signs out', async () => {
    const { user, router } = renderApp('/settings')

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(router.state.location.pathname).toBe('/login')
    expect(db.user).toBeNull()
  })
})
