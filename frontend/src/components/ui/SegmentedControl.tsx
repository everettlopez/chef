import { useId, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** An iOS-style segmented control, exposed as a radio group with arrow-key support. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId()

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as const)[
      event.key as 'ArrowRight'
    ]
    if (!step) return
    event.preventDefault()
    const index = options.findIndex((o) => o.value === value)
    const next = options[(index + step + options.length) % options.length]
    onChange(next.value)
    document.getElementById(`${name}-${next.value}`)?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex rounded-[0.625rem] bg-fill p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            id={`${name}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-10 min-w-0 flex-1 rounded-lg px-2 text-subhead font-medium whitespace-nowrap transition-all duration-200 sm:px-3',
              selected
                ? 'bg-surface-raised text-label shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-fill-strong'
                : 'text-label-secondary hover:text-label',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
