import { expect, test } from '@playwright/test'
import { inviteCode, signUp, stock } from './helpers'

test('a roommate joins by invite code and shares the pantry', async ({ browser }) => {
  const anaContext = await browser.newContext()
  const benContext = await browser.newContext()
  try {
    const ana = await anaContext.newPage()
    const ben = await benContext.newPage()
    await signUp(ana, 'Ana')
    await signUp(ben, 'Ben')
    await stock(ana, { name: 'milk', quantity: 1, storage: 'fridge' })
    const code = await inviteCode(ana)

    await ben.goto('/household')
    await ben.getByRole('button', { name: 'Join another household' }).click()
    await ben.getByRole('dialog').getByLabel('Invite code').fill(code.toLowerCase())
    await ben.getByRole('button', { name: 'Join household' }).click()
    await expect(ben.getByText("Welcome to Ana's Kitchen!")).toBeVisible()
    await expect(ben.getByRole('heading', { level: 1, name: "Ana's Kitchen" })).toBeVisible()

    await ben.goto('/pantry')
    await expect(ben.getByRole('button', { name: /Milk/ })).toBeVisible()

    await ana.goto('/household')
    await expect(ana.getByRole('heading', { name: 'Members · 2' })).toBeVisible()
    await expect(ana.getByText('Ben', { exact: true })).toBeVisible()
  } finally {
    await anaContext.close()
    await benContext.close()
  }
})

test('an unknown invite code is rejected', async ({ page }) => {
  await signUp(page)
  await page.goto('/household')
  await page.getByRole('button', { name: 'Join another household' }).click()
  await page.getByRole('dialog').getByLabel('Invite code').fill('ZZZZZZZZ')
  await page.getByRole('button', { name: 'Join household' }).click()

  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
    'No household has that invite code',
  )
})

test('rename and new invite code', async ({ page }) => {
  await signUp(page)
  await page.goto('/household')
  const before = await inviteCode(page)

  await page.getByRole('button', { name: 'Rename' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Apartment 4B')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Apartment 4B' })).toBeVisible()

  await page.getByRole('button', { name: 'New code' }).click()
  await expect(page.locator('code')).not.toHaveText(before)
})
