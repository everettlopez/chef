import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Ingredient } from '../api/pantry'
import { db } from '../test/db'
import { renderWithProviders } from '../test/render'
import { IngredientCombobox } from './IngredientCombobox'

function Harness({ onSelect }: { onSelect: (i: Ingredient) => void }) {
  const [value, setValue] = useState('')
  return (
    <IngredientCombobox
      value={value}
      onChange={setValue}
      onSelect={(i) => {
        onSelect(i)
        setValue(i.canonical_name)
      }}
    />
  )
}

function setup() {
  const onSelect = vi.fn()
  const view = renderWithProviders(<Harness onSelect={onSelect} />)
  const input = screen.getByRole('combobox', { name: 'Ingredient' })
  return { ...view, input, onSelect }
}

describe('IngredientCombobox', () => {
  it('suggests matches after a short debounce', async () => {
    const { user, input } = setup()

    await user.type(input, 'chick')

    const listbox = await screen.findByRole('listbox', { name: 'Ingredient suggestions' })
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(listbox).toHaveTextContent('Chicken Breast')
    // One request for the settled text, not one per keystroke.
    const searches = db.requests.filter((r) => r.path.startsWith('/ingredients'))
    expect(searches).toHaveLength(1)
  })

  it('picks with the keyboard and tracks the active option', async () => {
    const { user, input, onSelect } = setup()
    await user.type(input, 'i')
    await screen.findByRole('listbox')

    await user.keyboard('{ArrowDown}')
    const first = screen.getAllByRole('option')[0]
    expect(input).toHaveAttribute('aria-activedescendant', first.id)
    expect(first).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}')

    expect(onSelect).toHaveBeenCalledOnce()
    expect(input).toHaveValue(onSelect.mock.calls[0][0].canonical_name)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('picks with a click', async () => {
    const { user, input, onSelect } = setup()
    await user.type(input, 'spin')

    await user.click(await screen.findByRole('option', { name: /Spinach/ }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ canonical_name: 'spinach' }))
    expect(input).toHaveValue('spinach')
  })

  it('closes on Escape without bubbling (so a surrounding sheet stays open)', async () => {
    const { user, input } = setup()
    const onKeyDown = vi.fn()
    document.addEventListener('keydown', onKeyDown)
    await user.type(input, 'milk')
    await screen.findByRole('listbox')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(onKeyDown).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
    document.removeEventListener('keydown', onKeyDown)
  })

  it('says free text will become a new ingredient', async () => {
    const { user, input } = setup()

    await user.type(input, 'dragonfruit')

    expect(
      await screen.findByText(/"dragonfruit" will be added as a new ingredient/),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })
})
