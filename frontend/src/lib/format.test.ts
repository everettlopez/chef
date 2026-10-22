import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ingredient } from '../api/pantry'
import {
  addDays,
  daysUntil,
  defaultStorage,
  describeUsage,
  dietPrefLabel,
  expiryLabel,
  expiryTone,
  formatDateTime,
  formatMinutes,
  formatQuantity,
  formatShortDate,
  shelfDays,
  tagLabel,
  titleCase,
  toISODate,
  todayISO,
  URGENT_DAYS,
} from './format'

function ingredient(days: Partial<Ingredient>): Ingredient {
  return {
    id: 1,
    canonical_name: 'milk',
    category: 'dairy',
    default_unit: null,
    shelf_days_pantry: null,
    shelf_days_fridge: null,
    shelf_days_freezer: null,
    ...days,
  }
}

describe('text', () => {
  it('title-cases each word', () => {
    expect(titleCase('chicken breast')).toBe('Chicken Breast')
    expect(titleCase('')).toBe('')
  })

  it('labels tags', () => {
    expect(tagLabel('gluten-free')).toBe('Gluten Free')
    expect(dietPrefLabel({ name: 'vegan', kind: 'diet' })).toBe('Vegan')
    expect(dietPrefLabel({ name: 'contains-nuts', kind: 'allergen' })).toBe('Avoid nuts')
    expect(dietPrefLabel({ name: 'contains-tree-nuts', kind: 'allergen' })).toBe('Avoid tree nuts')
  })
})

describe('formatQuantity', () => {
  it.each([
    [null, 'cup', 'Have some'],
    [2, 'cup', '2 cup'],
    [2, null, '2'],
    [1.5, 'lb', '1.5 lb'],
    [0.333333, 'cup', '0.33 cup'],
    [1.1, null, '1.1'],
  ])('%s %s -> %s', (quantity, unit, expected) => {
    expect(formatQuantity(quantity, unit)).toBe(expected)
  })
})

describe('formatMinutes', () => {
  it.each([
    [null, null, null],
    [0, 0, null],
    [5, null, '5 min'],
    [10, 50, '1 hr'],
    [10, 70, '1 hr 20 min'],
    [null, 125, '2 hr 5 min'],
  ])('%s + %s -> %s', (prep, cook, expected) => {
    expect(formatMinutes(prep, cook)).toBe(expected)
  })
})

describe('dates', () => {
  // Late evening local time, so a UTC-based "today" would be wrong in the Americas.
  const NOW = new Date(2026, 2, 10, 23, 30)
  const fromToday = (days: number) => addDays('2026-03-10', days)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('uses local dates', () => {
    expect(todayISO()).toBe('2026-03-10')
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-03-10', 1)).toBe('2026-03-11')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('counts whole days, including across a daylight-saving change', () => {
    expect(daysUntil('2026-03-10')).toBe(0)
    expect(daysUntil('2026-03-13')).toBe(3)
    expect(daysUntil('2026-03-08')).toBe(-2)
    expect(daysUntil('2026-04-10')).toBe(31)
  })

  it.each([
    [null, 'none'],
    ['2026-03-09', 'expired'],
    ['2026-03-10', 'soon'],
    [fromToday(URGENT_DAYS), 'soon'],
    [fromToday(URGENT_DAYS + 1), 'fresh'],
  ])('expiryTone(%s) is %s', (date, tone) => {
    expect(expiryTone(date)).toBe(tone)
  })

  it.each([
    [null, 'No date'],
    ['2026-03-05', 'Expired 5 days ago'],
    ['2026-03-09', 'Expired yesterday'],
    ['2026-03-10', 'Expires today'],
    ['2026-03-11', 'Expires tomorrow'],
    ['2026-03-24', 'Expires in 14 days'],
  ])('expiryLabel(%s) is %s', (date, label) => {
    expect(expiryLabel(date)).toBe(label)
  })

  it('shows a calendar date beyond two weeks', () => {
    expect(formatShortDate('2026-03-25')).toMatch(/Mar/)
    expect(expiryLabel('2026-03-25')).toBe(`Expires ${formatShortDate('2026-03-25')}`)
  })

  it('treats API timestamps as UTC', () => {
    expect(formatDateTime('2026-03-01T18:30:00')).toBe(formatDateTime('2026-03-01T18:30:00Z'))
  })
})

describe('storage', () => {
  it('reads shelf days per storage', () => {
    const milk = ingredient({ shelf_days_fridge: 7, shelf_days_freezer: 90 })
    expect(shelfDays(milk, 'fridge')).toBe(7)
    expect(shelfDays(milk, 'freezer')).toBe(90)
    expect(shelfDays(milk, 'pantry')).toBeNull()
  })

  it.each([
    [{ shelf_days_pantry: 5, shelf_days_fridge: 9 }, 'pantry'],
    [{ shelf_days_fridge: 9 }, 'fridge'],
    [{ shelf_days_freezer: 90 }, 'freezer'],
    [{}, 'pantry'],
  ])('defaultStorage(%o) is %s', (days, storage) => {
    expect(defaultStorage(ingredient(days))).toBe(storage)
  })
})

describe('describeUsage', () => {
  it('shows the amount when one was deducted', () => {
    expect(describeUsage({ ingredient_name: 'chicken breast', quantity_used: 1, unit: 'lb' })).toBe(
      '1 lb chicken breast',
    )
    expect(describeUsage({ ingredient_name: 'egg', quantity_used: 3, unit: null })).toBe('3 egg')
  })

  it('shows just the name when the batch was used up', () => {
    expect(describeUsage({ ingredient_name: 'spinach', quantity_used: null, unit: 'cup' })).toBe(
      'Spinach',
    )
  })
})
