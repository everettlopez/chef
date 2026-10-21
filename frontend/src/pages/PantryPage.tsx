import { useState, type FormEvent } from 'react'
import { useCreatePantryItem, usePantryItems } from '../hooks/usePantryItems'

export function PantryPage() {
  const { data: items, isPending, isError } = usePantryItems()
  const createItem = useCreatePantryItem()

  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createItem.mutate(
      { name, quantity: Number(quantity), unit: unit.trim() || null },
      {
        onSuccess: () => {
          setName('')
          setQuantity('1')
          setUnit('')
        },
      },
    )
  }

  return (
    <section>
      <h1>Pantry</h1>

      <form className="item-form" onSubmit={handleSubmit}>
        <input
          aria-label="Name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
        />
        <input
          aria-label="Quantity"
          type="number"
          min="0.01"
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <input
          aria-label="Unit"
          placeholder="Unit (optional)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          maxLength={32}
        />
        <button type="submit" disabled={createItem.isPending}>
          {createItem.isPending ? 'Adding…' : 'Add item'}
        </button>
      </form>
      {createItem.isError && <p className="status status-error">Could not add item.</p>}

      {isPending && <p>Loading…</p>}
      {isError && <p className="status status-error">Could not load pantry items.</p>}
      {items && items.length === 0 && <p>Your pantry is empty.</p>}
      {items && items.length > 0 && (
        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <span>
                {item.quantity} {item.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
