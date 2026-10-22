import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '../../lib/cn'

type Variant = 'filled' | 'tinted' | 'plain' | 'gray' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold ' +
  'transition-[background-color,transform,opacity] duration-150 ease-out active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-40 [&>svg]:size-[1.125rem] [&>svg]:shrink-0'

const variants: Record<Variant, string> = {
  filled: 'bg-brand text-on-brand hover:bg-brand-hover',
  tinted: 'bg-brand-tint text-brand hover:bg-brand-tint-strong',
  plain: 'text-brand hover:bg-brand-tint',
  gray: 'bg-fill text-label hover:bg-fill-strong',
  destructive: 'bg-danger-tint text-danger hover:bg-danger/15',
}

// Every size keeps the 44 x 44 pt minimum hit target.
const sizes: Record<Size, string> = {
  sm: 'min-h-11 px-3 text-subhead',
  md: 'min-h-11 px-4 text-body',
  lg: 'min-h-[3.25rem] px-5 text-body',
}

function buttonClass(variant: Variant = 'filled', size: Size = 'md', extra?: string) {
  return cn(base, variants[variant], sizes[size], extra)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function Button({
  variant = 'filled',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends Omit<LinkProps, 'className'> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  className?: string
}

export function ButtonLink({
  variant = 'filled',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
}

/** A 44 x 44 icon-only button; `label` is its accessible name. */
export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full text-brand',
        'transition-colors hover:bg-brand-tint',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
