import { createContext, useContext } from 'react'

export interface ToastOptions {
  message: string
  actionLabel?: string
  onAction?: () => void
}

export const ToastContext = createContext<(options: ToastOptions) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}
