import { expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

export const PASSWORD = 'correct-horse-battery'

/** Every test signs up its own user, so tests can run in parallel on one database. */
export function uniqueEmail(): string {
  return `e2e-${randomUUID()}@chef.test`
}

export async function signUp(page: Page, name = 'Cook'): Promise<string> {
  const email = uniqueEmail()
  await page.goto('/signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'What can I make?' })).toBeVisible()
  return email
}

interface Stock {
  name: string
  quantity?: number
  unit?: string
  storage?: 'pantry' | 'fridge' | 'freezer'
  expiresInDays?: number
}

/** YYYY-MM-DD `days` from today in local time, matching the backend's date.today(). */
function localDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Fast setup through the API, using the page's session cookie. */
export async function stock(page: Page, ...items: (string | Stock)[]): Promise<void> {
  for (const entry of items) {
    const {
      name,
      quantity,
      unit,
      storage = 'pantry',
      expiresInDays,
    } = typeof entry === 'string' ? { name: entry } : entry
    const expires_on = expiresInDays === undefined ? undefined : localDate(expiresInDays)
    const response = await page.request.post('/api/pantry', {
      data: { name, quantity, unit, storage, expires_on },
    })
    expect(response.status(), await response.text()).toBe(201)
  }
}

export async function inviteCode(page: Page): Promise<string> {
  const response = await page.request.get('/api/household')
  return (await response.json()).invite_code
}
