import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { errorMessage } from '../api/client'
import { Logo } from '../components/AppLayout'
import { Button } from '../components/ui/Button'
import { ErrorBanner } from '../components/ui/Feedback'
import { TextField } from '../components/ui/TextField'
import { useLogin, useMe, useSignup } from '../hooks/useAuth'

function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-title1 font-bold">{title}</h1>
        <p className="mt-2 mb-8 text-center text-callout text-label-secondary">{subtitle}</p>
        <div className="rounded-[1.25rem] bg-surface p-6 shadow-card">{children}</div>
        <p className="mt-6 text-center text-subhead text-label-secondary">{footer}</p>
      </div>
    </main>
  )
}

/** Where to go after signing in: the page that sent us here, or home. */
function useReturnTo(): string {
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  return from && from !== '/login' && from !== '/signup' ? from : '/'
}

export function LoginPage() {
  const { data: user } = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const returnTo = useReturnTo()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (user) return <Navigate to={returnTo} replace />

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    login.mutate({ email, password }, { onSuccess: () => navigate(returnTo, { replace: true }) })
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see what you can cook tonight."
      footer={
        <>
          New to Chef?{' '}
          <Link to="/signup" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {login.isError && <ErrorBanner>{errorMessage(login.error)}</ErrorBanner>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}

export function SignupPage() {
  const { data: user } = useMe()
  const signup = useSignup()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (user) return <Navigate to="/" replace />

  const passwordTooShort = password.length > 0 && password.length < 8

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    signup.mutate(
      { display_name: displayName, email, password },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  return (
    <AuthShell
      title="Create your kitchen"
      subtitle="A shared pantry that tells you what to cook — and what to use first."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {signup.isError && <ErrorBanner>{errorMessage(signup.error)}</ErrorBanner>}
        <TextField
          label="Your name"
          autoComplete="given-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          required
          autoFocus
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
          error={passwordTooShort ? 'Use at least 8 characters.' : null}
          minLength={8}
          required
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={signup.isPending || passwordTooShort || !displayName.trim() || !email.trim()}
        >
          {signup.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}
