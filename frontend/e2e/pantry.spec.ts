import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

test.beforeEach(async ({ page }) => {
  await signUp(page)
  await page.goto('/pantry')
})

test('add with autocomplete, edit, then discard and undo', async ({ page }) => {
  await page.getByRole('button', { name: 'Add your first item' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add to pantry' })

  await sheet.getByRole('combobox', { name: 'Ingredient' }).fill('chick')
  await sheet.getByRole('option', { name: /Chicken Breast/ }).click()
  await expect(sheet.getByRole('radio', { name: 'Fridge' })).toBeChecked() // no pantry shelf life
  await expect(sheet.getByLabel('Unit')).toHaveValue('lb')
  await sheet.getByLabel('Quantity').fill('2')
  await sheet.getByRole('button', { name: 'Add to pantry' }).click()

  await expect(page.getByText('Added Chicken Breast to your pantry.')).toBeVisible()
  const row = page.getByRole('button', { name: /Chicken Breast/ })
  await expect(row).toContainText('2 lb')
  await expect(row).toContainText('Expires in 2 days')
  await expect(page.getByRole('heading', { name: 'Use soon · 1' })).toBeVisible()

  await row.click()
  const edit = page.getByRole('dialog', { name: 'Chicken Breast' })
  await edit.getByLabel('Quantity').fill('1.5')
  await edit.getByRole('radio', { name: 'Freezer' }).click()
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(row).toContainText('1.5 lb')
  await expect(page.getByRole('heading', { name: 'Fresh · 1' })).toBeVisible()

  await row.click()
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('heading', { name: 'Nothing here yet' })).toBeVisible()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(row).toContainText('1.5 lb')
})

test('free text resolves aliases and "have some" needs no quantity', async ({ page }) => {
  await page.getByRole('button', { name: 'Add your first item' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add to pantry' })
  const field = sheet.getByRole('combobox', { name: 'Ingredient' })
  await field.fill('scallions')
  // Wait for the suggestions, so Escape closes them rather than the sheet.
  await expect(sheet.getByRole('option', { name: /Green Onion/ })).toBeVisible()
  await field.press('Escape')
  await expect(sheet.getByRole('listbox')).toBeHidden()
  await sheet.getByRole('button', { name: 'Add to pantry' }).click()

  const row = page.getByRole('button', { name: /Green Onion/ })
  await expect(row).toContainText('Have some')
})

test('the pantry survives a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Add your first item' }).click()
  await page.getByRole('combobox', { name: 'Ingredient' }).fill('rice')
  await page.getByRole('option', { name: /^Rice/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add to pantry' }).click()
  await expect(page.getByRole('button', { name: /Rice/ })).toBeVisible()

  await page.reload()

  await expect(page.getByRole('button', { name: /Rice/ })).toBeVisible()
  await expect(page.getByText('1 item shared with your household')).toBeVisible()
})
