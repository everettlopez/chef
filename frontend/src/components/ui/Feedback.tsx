import { AlertCircle } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl bg-surface p-5 shadow-card', className)} {...props} />
}

interface EmptyStateProps {
  icon: ReactNode
  title: string
  message: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center shadow-card">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-tint text-brand [&>svg]:size-7">
        {icon}
      </div>
      <h2 className="text-title3 font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-subhead text-label-secondary">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl bg-danger-tint px-3.5 py-3 text-subhead text-danger"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-[1.125rem] shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-fill', className)} />
}

/** Placeholder rows while a list loads. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface shadow-card"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
}

/** HIG large-title page header. */
export function PageHeader({ title, subtitle, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-8">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="text-large-title font-bold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-callout text-label-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
