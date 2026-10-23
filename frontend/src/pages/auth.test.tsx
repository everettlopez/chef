import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, PASSWORD } from '../test/db'
import { renderApp } from '../test/render'

describe('RequireAuth', () => {
  it('sends signed-out visitors to sign in', async () => {
    db.user = null
    const { router } = renderApp('/pantry')

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('shows the app shell with navigation when signed in', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'What can I make?' })).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(2) // bar + tabs
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(await screen.findByText(/All systems normal/)).toBeInTheDocument()
  })

  it('marks the current tab', async () => {
    renderApp('/pantry')
    await screen.findByRole('heading', { name: 'Pantry' })

    for (const link of screen.getAllByRole('link', { name: /Pantry/ }))
      expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('signs out when the session expires mid-use', async () => {
    const { router } = renderApp('/pantry')
    await screen.findByRole('heading', { name: 'Pantry' })

    db.user = null // the cookie expired
    await router.navigate('/history')

    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(router.state.location.pathname).toBe('/login')
  })

  it('shows a not-found page inside the shell', async () => {
    renderApp('/nowhere')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })
})

describe('LoginPage', () => {
  it('shows the server error for a wrong password', async () => {
    db.user = null
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'cook@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
  })

  it('returns to the page that asked for sign-in', async () => {
    db.user = null
    const { user, router } = renderApp('/history')
    await screen.findByRole('heading', { name: 'Welcome back' })

    await user.type(screen.getByLabelText('Email'), 'cook@example.com')
    await user.type(screen.getByLabelText('Password'), PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByRole('heading', { name: 'History' })
    expect(router.state.location.pathname).toBe('/history')
  })

  it('redirects home when already signed in', async () => {
    const { router } = renderApp('/login')
    await screen.findByRole('heading', { name: 'What can I make?' })
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('SignupPage', () => {
  it('validates the password length before submitting', async () => {
    db.user = null
    const { user } = renderApp('/signup')
    await user.type(await screen.findByLabelText('Your name'), 'Ana')
    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    const submit = screen.getByRole('button', { name: 'Create account' })

    await user.type(screen.getByLabelText('Password'), 'short')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Use at least 8 characters.',
    )
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Password'), '-enough')
    expect(submit).toBeEnabled()
  })

  it('creates the account and lands on home', async () => {
    db.user = null
    const { user, router } = renderApp('/signup')
    await user.type(await screen.findByLabelText('Your name'), 'Ana')
    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), 'long-enough')

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await screen.findByText(/, Ana$/)).toBeInTheDocument()
  })

  it('shows a conflict for an existing email', async () => {
    db.user = null
    const { user } = renderApp('/signup')
    await user.type(await screen.findByLabelText('Your name'), 'Cook')
    await user.type(screen.getByLabelText('Email'), 'cook@example.com')
    await user.type(screen.getByLabelText('Password'), 'long-enough')

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
  })
})
