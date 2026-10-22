import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { cn } from '../../lib/cn'

export const inputClass =
  'block w-full min-h-11 rounded-xl bg-fill px-3.5 text-body text-label ' +
  'placeholder:text-label-tertiary outline-none transition-shadow ' +
  'focus:ring-[3px] focus:ring-brand/40 aria-invalid:ring-2 aria-invalid:ring-danger/60'

export const fieldLabelClass = 'mb-1.5 block text-footnote font-medium text-label-secondary'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: ReactNode
  error?: string | null
  hideLabel?: boolean
  ref?: Ref<HTMLInputElement>
}

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  className,
  id,
  ...props
}: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`

  return (
    <div className={className}>
      <label htmlFor={inputId} className={cn(fieldLabelClass, hideLabel && 'sr-only')}>
        {label}
      </label>
      <input
        id={inputId}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? hintId : undefined}
        {...props}
      />
      {(error || hint) && (
        <p
          id={hintId}
          className={cn('mt-1.5 text-footnote', error ? 'text-danger' : 'text-label-secondary')}
        >
          {error || hint}
        </p>
      )}
    </div>
  )
}
