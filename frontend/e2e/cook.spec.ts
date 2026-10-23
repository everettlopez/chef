import { expect, test, type Page } from '@playwright/test'
import { signUp, stock } from './helpers'

const CHICKEN = 'Garlic Butter Chicken with Spinach Rice'

async function chickenRow(page: Page) {
  await page.goto('/pantry')
  return page.getByRole('button', { name: /Chicken Breast/ })
}

test.beforeEach(async ({ page }) => {
  await signUp(page)
  await stock(
    page,
    { name: 'chicken breast', quantity: 2, unit: 'lb', storage: 'fridge' },
    'rice',
    'spinach',
    'garlic',
    'butter',
    'lemon',
  )
})

test('a fully stocked recipe ranks first and is marked ready', async ({ page }) => {
  await page.goto('/')

  const first = page.getByRole('list', { name: 'Suggested recipes' }).getByRole('listitem').first()
  await expect(first).toContainText(CHICKEN)
  await expect(first).toContainText('Ready')
  await expect(first).toContainText('You have 6 of 6')

  await page.getByRole('radio', { name: 'Ready now' }).click()
  await expect(page.getByRole('list', { name: 'Suggested recipes' })).toContainText(CHICKEN)
})

test('cooking deducts from the pantry and undo restores it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: new RegExp(CHICKEN) }).click()
  await expect(page.getByRole('heading', { level: 1, name: CHICKEN })).toBeVisible()
  await expect(page.getByText('You have 6 of 6')).toBeVisible()

  await page.getByRole('button', { name: 'I cooked this' }).click()
  await page.getByRole('button', { name: 'Log meal & update pantry' }).click()
  const toast = page.getByRole('status').filter({ hasText: 'Logged!' })
  await expect(toast).toContainText('1 lb chicken breast')

  await expect(await chickenRow(page)).toContainText('1 lb')

  await page.goto('/history')
  await expect(page.getByText(CHICKEN)).toBeVisible()
  await page.getByRole('button', { name: `Undo ${CHICKEN}` }).click()
  await expect(page.getByText(`Undid ${CHICKEN}. Pantry restored.`)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No meals logged yet' })).toBeVisible()

  await expect(await chickenRow(page)).toContainText('2 lb')
})

test('cooking more servings uses more', async ({ page }) => {
  await page.goto('/recipes?q=garlic%20butter')
  await page.getByRole('link', { name: new RegExp(CHICKEN) }).click()
  await page.getByRole('button', { name: 'I cooked this' }).click()
  await page.getByRole('button', { name: 'More servings' }).click()
  await page.getByRole('button', { name: 'More servings' }).click()
  await page.getByRole('button', { name: 'Log meal & update pantry' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Logged!' })).toContainText(
    '2 lb chicken breast',
  )
  // 4 servings at 1 lb per 2 uses up both pounds.
  await page.goto('/pantry')
  await expect(page.getByRole('heading', { name: 'Pantry' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Rice/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Chicken Breast/ })).toHaveCount(0)
})

test('soon-to-expire items are called out', async ({ page }) => {
  await stock(page, { name: 'egg', quantity: 6, expiresInDays: 1 }, 'cheddar cheese')
  await page.goto('/')

  const omelette = page
    .getByRole('list', { name: 'Suggested recipes' })
    .getByRole('listitem')
    .filter({ hasText: 'Spinach & Cheddar Omelette' })
  await expect(omelette).toContainText('Uses soon: Egg')
})
