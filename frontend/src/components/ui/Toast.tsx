import { CheckCircle2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastOptions } from './toastContext'

interface ToastState extends ToastOptions {
  id: number
}

const DURATION_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    timer.current = window.setTimeout(() => setToast(null), DURATION_MS)
    return () => window.clearTimeout(timer.current)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Sits above the tab bar on phones. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 sm:bottom-8"
      >
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-md animate-toast-in items-center gap-3 rounded-2xl bg-[#1c1c1e]/95 py-1.5 pr-1.5 pl-4 text-white shadow-sheet backdrop-blur-xl dark:bg-[#3a3a3c]/95"
          >
            <CheckCircle2 aria-hidden className="size-5 shrink-0 text-[#5fd3a0]" />
            <p className="flex-1 py-2 text-subhead">{toast.message}</p>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.()
                  setToast(null)
                }}
                className="min-h-11 rounded-xl px-3 text-subhead font-semibold text-[#5fd3a0] hover:bg-white/10"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
