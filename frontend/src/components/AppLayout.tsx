import {
  ChefHat,
  History,
  Home,
  Refrigerator,
  Settings,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useMe } from '../hooks/useAuth'
import { useHealth } from '../hooks/useHealth'
import { cn } from '../lib/cn'
import { Skeleton } from './ui/Feedback'

const tabs = [
  { to: '/', label: 'Cook', longLabel: 'What can I make', icon: Sparkles, end: true },
  { to: '/pantry', label: 'Pantry', longLabel: 'Pantry', icon: Refrigerator },
  { to: '/recipes', label: 'Recipes', longLabel: 'Recipes', icon: UtensilsCrossed },
  { to: '/history', label: 'History', longLabel: 'History', icon: History },
  { to: '/household', label: 'Household', longLabel: 'Household', icon: Home },
]

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex size-8 items-center justify-center rounded-[0.625rem] bg-brand text-on-brand">
        <ChefHat aria-hidden className="size-[1.125rem]" strokeWidth={2.25} />
      </span>
      <span className="text-headline font-semibold tracking-tight">Chef</span>
    </span>
  )
}

/** Routes behind sign-in. Shows a quiet skeleton while the session is checked. */
export function RequireAuth() {
  const { data: user, isPending } = useMe()
  const location = useLocation()

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 pt-20" role="status" aria-label="Loading">
        <Skeleton className="h-10 w-2/3 max-w-sm" />
        <Skeleton className="h-5 w-1/2 max-w-xs" />
        <Skeleton className="mt-6 h-40" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <AppLayout />
}

function AppLayout() {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-brand px-4 py-2 text-on-brand focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-separator bg-bar pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/" aria-label="Chef home" className="rounded-xl">
            <Logo />
          </NavLink>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {tabs.map(({ to, longLabel, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-11 items-center rounded-xl px-3 text-subhead font-medium transition-colors',
                    isActive
                      ? 'bg-brand-tint text-brand'
                      : 'text-label-secondary hover:bg-fill hover:text-label',
                  )
                }
              >
                {longLabel}
              </NavLink>
            ))}
          </nav>
          <NavLink
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className={({ isActive }) =>
              cn(
                'inline-flex size-11 items-center justify-center rounded-full transition-colors',
                isActive ? 'bg-brand-tint text-brand' : 'text-label-secondary hover:bg-fill',
              )
            }
          >
            <Settings aria-hidden className="size-[1.375rem]" />
          </NavLink>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto max-w-5xl px-4 pt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10 md:pb-16"
      >
        <Outlet />
        <StatusFooter />
      </main>

      {/* Phone tab bar. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-separator bg-bar pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[0.6875rem] font-medium transition-colors',
                    isActive ? 'text-brand' : 'text-label-tertiary hover:text-label-secondary',
                  )
                }
              >
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function StatusFooter() {
  const { data, isError } = useHealth()
  const ok = data?.status === 'ok' && data.database === 'ok'
  return (
    <footer className="mt-16 flex items-center justify-center gap-2 text-caption text-label-tertiary">
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          ok ? 'bg-success' : isError ? 'bg-danger' : 'bg-fill-strong',
        )}
      />
      {ok ? 'All systems normal' : isError ? 'API or database unreachable' : 'Checking status…'}
      <span aria-hidden>·</span>
      Chef prototype
    </footer>
  )
}
