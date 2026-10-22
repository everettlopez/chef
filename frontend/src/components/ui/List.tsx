import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '../../lib/cn'

interface ListProps {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}

/** An inset grouped list: a rounded section on the grouped background. */
export function List({ header, footer, children, className }: ListProps) {
  return (
    <section className={className}>
      {header && (
        <h2 className="mb-2 px-4 text-footnote font-semibold tracking-wide text-label-secondary uppercase">
          {header}
        </h2>
      )}
      <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface shadow-card">
        {children}
      </ul>
      {footer && <p className="mt-2 px-4 text-footnote text-label-secondary">{footer}</p>}
    </section>
  )
}

interface ListRowProps {
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  to?: string
  onClick?: () => void
  chevron?: boolean
  className?: string
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  to,
  onClick,
  chevron,
  className,
}: ListRowProps) {
  const content = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-label">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block text-subhead text-label-secondary">{subtitle}</span>
        )}
      </span>
      {trailing && (
        <span className="flex shrink-0 items-center gap-2 text-subhead text-label-secondary">
          {trailing}
        </span>
      )}
      {(chevron ?? Boolean(to || onClick)) && (
        <ChevronRight aria-hidden className="size-5 shrink-0 text-label-tertiary" />
      )}
    </>
  )
  const rowClass = cn('flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left', className)
  const interactive =
    'transition-colors hover:bg-fill/60 active:bg-fill focus-visible:-outline-offset-4'

  return (
    <li>
      {to ? (
        <Link to={to} className={cn(rowClass, interactive)}>
          {content}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cn(rowClass, interactive)}>
          {content}
        </button>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  )
}
