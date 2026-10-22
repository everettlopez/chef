import { Plus } from 'lucide-react'
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { Ingredient } from '../api/pantry'
import { useIngredientSearch } from '../hooks/usePantry'
import { cn } from '../lib/cn'
import { titleCase } from '../lib/format'
import { fieldLabelClass, inputClass } from './ui/TextField'

interface IngredientComboboxProps {
  value: string
  onChange: (text: string) => void
  onSelect: (ingredient: Ingredient) => void
  autoFocus?: boolean
}

/** Pantry autocomplete (ARIA 1.2 combobox). Free text is still allowed; the API resolves it. */
export function IngredientCombobox({
  value,
  onChange,
  onSelect,
  autoFocus,
}: IngredientComboboxProps) {
  const id = useId()
  const listId = `${id}-list`
  const [debounced, setDebounced] = useState(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), 150)
    return () => window.clearTimeout(timer)
  }, [value])

  const { data: options = [] } = useIngredientSearch(debounced)
  const visible = open && value.trim().length > 0 && options.length > 0

  function choose(ingredient: Ingredient) {
    onSelect(ingredient)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && visible && active >= 0) {
      event.preventDefault()
      choose(options[active])
    } else if (event.key === 'Escape' && visible) {
      // Close the list without closing the surrounding sheet.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className={fieldLabelClass}>
        Ingredient
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="e.g. milk, spinach, chicken breast"
        className={inputClass}
        value={value}
        data-autofocus={autoFocus || undefined}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        required
        maxLength={120}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Ingredient suggestions"
        hidden={!visible}
        className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-64 animate-fade-in overflow-y-auto rounded-xl bg-surface-raised py-1 shadow-sheet ring-1 ring-separator"
      >
        {options.map((option, index) => (
          <li
            key={option.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(option)}
            className={cn(
              'flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3.5 text-body',
              index === active ? 'bg-brand-tint text-brand' : 'hover:bg-fill',
            )}
          >
            <span>{titleCase(option.canonical_name)}</span>
            <span className="text-footnote text-label-tertiary capitalize">{option.category}</span>
          </li>
        ))}
      </ul>
      {open && value.trim().length > 1 && options.length === 0 && debounced === value && (
        <p className="mt-1.5 flex items-center gap-1.5 text-footnote text-label-secondary">
          <Plus aria-hidden className="size-3.5" />"{value.trim()}" will be added as a new
          ingredient.
        </p>
      )}
    </div>
  )
}
