import { expect, test } from '@playwright/test'
import { PASSWORD, signUp, uniqueEmail } from './helpers'

test('sign up lands on suggestions with a greeting', async ({ page }) => {
  await signUp(page, 'Ana')

  await expect(page.getByText(/, Ana$/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your pantry is empty' })).toBeVisible()
  await expect(page.getByText('All systems normal')).toBeVisible()
})

test('the session cookie is HttpOnly', async ({ page, context }) => {
  await signUp(page)

  const session = (await context.cookies()).find((c) => c.name === 'chef_session')
  expect(session?.httpOnly).toBe(true)
  expect(await page.evaluate(() => document.cookie)).not.toContain('chef_session')
})

test('sign out, then sign back in', async ({ page }) => {
  const email = await signUp(page)

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'What can I make?' })).toBeVisible()
})

test('a wrong password shows an error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password')
})

test('protected pages redirect to sign in and back', async ({ page }) => {
  const email = await signUp(page)
  await page.context().clearCookies()

  await page.goto('/history')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
})
