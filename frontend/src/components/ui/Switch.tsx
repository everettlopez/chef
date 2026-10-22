import { cn } from '../../lib/cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // The visible track is 51 x 31 like iOS; padding keeps a 44 pt hit area.
      className="-my-1.5 inline-flex min-h-11 items-center rounded-full px-1 disabled:opacity-40"
    >
      <span
        className={cn(
          'relative inline-flex h-[1.9375rem] w-[3.1875rem] rounded-full transition-colors duration-200',
          checked ? 'bg-brand' : 'bg-fill-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-[1.6875rem] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)]',
            'transition-transform duration-200 ease-out-soft',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}
