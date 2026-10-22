import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'neutral' | 'brand' | 'warning' | 'danger'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-fill text-label-secondary',
  brand: 'bg-brand-tint text-brand',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
}

interface BadgeProps {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
}

/** A small status pill. Pass an icon too, so meaning never relies on color alone. */
export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-footnote font-medium whitespace-nowrap',
        '[&>svg]:size-3.5 [&>svg]:shrink-0',
        tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  )
}
