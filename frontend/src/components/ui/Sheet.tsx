import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
}

/**
 * A modal sheet: slides up from the bottom on phones, a centered dialog on larger screens.
 * Built on <dialog>, which traps focus, closes on Esc and restores focus on close.
 */
export function Sheet({ open, onClose, title, description, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() focuses the first focusable element (the Close button). React's
      // autoFocus doesn't render an attribute, so fields opt in with data-autofocus.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === e.currentTarget) onClose()
      }}
      className={
        'mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[1.25rem] ' +
        'bg-surface-raised p-0 text-label shadow-sheet open:animate-sheet-in ' +
        'sm:m-auto sm:max-w-lg sm:rounded-[1.25rem]'
      }
    >
      <div className="px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4 sm:pb-6">
        <div aria-hidden className="mx-auto mb-2 h-1.5 w-9 rounded-full bg-fill-strong sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="pt-2">
            <h2 id={titleId} className="text-title3 font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-subhead text-label-secondary">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 text-label-secondary">
            <X aria-hidden className="size-5" />
          </IconButton>
        </div>
        <div className="mt-4">{open && children}</div>
      </div>
    </dialog>
  )
}
