import { expect, test } from '@playwright/test'
import { signUp, stock } from './helpers'

test('diet preferences filter suggestions', async ({ page }) => {
  await signUp(page)
  await stock(page, 'pasta', 'peanut butter', 'soy sauce', 'garlic', 'lime')
  await page.goto('/')
  const suggestions = page.getByRole('list', { name: 'Suggested recipes' })
  await expect(suggestions).toContainText('Peanut Sesame Noodles')

  await page.goto('/settings')
  // The switch flips before the save finishes; wait for it so the reload below can't cancel it.
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/me/diet-prefs') && r.request().method() === 'PUT',
  )
  await page.getByRole('switch', { name: 'Avoid nuts' }).click()
  await expect(page.getByRole('switch', { name: 'Avoid nuts' })).toBeChecked()
  expect((await saved).ok()).toBe(true)

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Avoid nuts' })).toBeVisible()
  await expect(suggestions).not.toContainText('Peanut Sesame Noodles')

  await page.reload()
  await expect(page.getByRole('link', { name: 'Avoid nuts' })).toBeVisible()
})

test('recipe search and diet filter', async ({ page }) => {
  await signUp(page)
  await page.goto('/recipes')
  await expect(page.getByRole('heading', { name: '40 recipes' })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('chickpeas')
  await expect(page).toHaveURL(/q=chickpeas/)
  await expect(page.getByRole('heading', { name: '1 recipe' })).toBeVisible()

  await page.getByRole('button', { name: 'Clear search' }).click()
  await page.getByRole('button', { name: 'Vegan' }).click()
  await expect(page.getByRole('button', { name: 'Vegan' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: /\d+ recipes?/ })).not.toHaveText('40 recipes')
})

// Regression: a diet click inside the 250 ms search debounce used to be overwritten when the
// debounce fired (reproduced at 200 ms in Chromium).
test('a diet filter picked right after editing the search sticks', async ({ page }) => {
  await signUp(page)
  for (const delay of [0, 100, 150, 200, 225, 245]) {
    await page.goto('/recipes?q=chickpeas')
    await expect(page.getByRole('heading', { name: '1 recipe' })).toBeVisible()

    await page.getByRole('button', { name: 'Clear search' }).click()
    await page.waitForTimeout(delay)
    await page.getByRole('button', { name: 'Vegan' }).click()
    await page.waitForTimeout(400) // past the debounce

    expect(new URL(page.url()).search, `clicked after ${delay} ms`).toBe('?tag=2')
    await expect(page.getByRole('button', { name: 'Vegan' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }
})

test('navigation works at this width', async ({ page }) => {
  await signUp(page)
  const nav = page.getByRole('navigation', { name: 'Primary' }).filter({ visible: true })
  await expect(nav).toHaveCount(1)

  // Desktop shows the top bar, phones the tab bar; exactly one is visible.
  for (const [label, heading] of [
    ['Pantry', 'Pantry'],
    ['Recipes', 'Recipes'],
    ['History', 'History'],
    ['Household', "Cook's Kitchen"],
  ]) {
    await nav.getByRole('link', { name: label }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})

test('the page never scrolls sideways', async ({ page }) => {
  await signUp(page)
  await stock(page, 'chicken breast', 'rice', 'spinach', 'garlic', 'butter', 'lemon')

  for (const path of ['/', '/pantry', '/recipes', '/recipes/1', '/history', '/household']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

test('keyboard only: add an item', async ({ page }) => {
  await signUp(page)
  await page.goto('/pantry')

  await page.getByRole('button', { name: 'Add item' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: 'Ingredient' })).toBeFocused()
  await page.keyboard.type('spin')
  await expect(page.getByRole('option', { name: /Spinach/ })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: 'Ingredient' })).toHaveValue('Spinach')

  // Tab to the submit button and press it.
  const submit = page.getByRole('dialog').getByRole('button', { name: 'Add to pantry' })
  for (let i = 0; i < 10 && !(await submit.evaluate((el) => el === document.activeElement)); i++)
    await page.keyboard.press('Tab')
  await expect(submit).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('button', { name: /Spinach/ })).toBeVisible()
})

test('Escape closes a sheet and returns focus', async ({ page }) => {
  await signUp(page)
  await page.goto('/pantry')
  const add = page.getByRole('button', { name: 'Add item' })

  await add.click()
  await expect(page.getByRole('dialog', { name: 'Add to pantry' })).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(add).toBeFocused()
})

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' })

  test('switches to the dark palette', async ({ page }) => {
    await signUp(page)

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const [r, g, b] = background.match(/\d+/g)!.map(Number)
    expect(r + g + b, background).toBeLessThan(100)
    await expect(page.getByRole('heading', { name: 'What can I make?' })).toBeVisible()
  })
})
