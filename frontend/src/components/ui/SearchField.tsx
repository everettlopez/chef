import { Search, X } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onChange: (value: string) => void
  label: string
}

export function SearchField({ value, onChange, label, className, ...props }: SearchFieldProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-[1.125rem] -translate-y-1/2 text-label-tertiary"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'block min-h-11 w-full rounded-xl bg-fill pr-11 pl-10 text-body text-label outline-none',
          'placeholder:text-label-tertiary focus:ring-[3px] focus:ring-brand/40',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 items-center justify-center"
        >
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-label-tertiary text-surface">
            <X aria-hidden className="size-3.5" strokeWidth={3} />
          </span>
        </button>
      )}
    </div>
  )
}
