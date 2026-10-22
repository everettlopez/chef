import type { Ingredient, Storage } from '../api/pantry'

export function titleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return 'Have some'
  const amount = Number.isInteger(quantity) ? String(quantity) : String(+quantity.toFixed(2))
  return unit ? `${amount} ${unit}` : amount
}

export function formatMinutes(prep: number | null, cook: number | null): string | null {
  const total = (prep ?? 0) + (cook ?? 0)
  if (!total) return null
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(): string {
  return toISODate(new Date())
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/** Whole days from today until the date (negative when past). */
export function daysUntil(iso: string): number {
  const today = parseISODate(todayISO())
  return Math.round((parseISODate(iso).getTime() - today.getTime()) / 86_400_000)
}

export function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string): string {
  // The API returns naive UTC timestamps.
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`)
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export type ExpiryTone = 'expired' | 'soon' | 'fresh' | 'none'

/** Matches the recommender's urgency window (URGENT_DAYS in services/recipes.py). */
export const URGENT_DAYS = 3

export function expiryTone(expiresOn: string | null): ExpiryTone {
  if (!expiresOn) return 'none'
  const days = daysUntil(expiresOn)
  if (days < 0) return 'expired'
  if (days <= URGENT_DAYS) return 'soon'
  return 'fresh'
}

export function expiryLabel(expiresOn: string | null): string {
  if (!expiresOn) return 'No date'
  const days = daysUntil(expiresOn)
  if (days < -1) return `Expired ${-days} days ago`
  if (days === -1) return 'Expired yesterday'
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (days <= 14) return `Expires in ${days} days`
  return `Expires ${formatShortDate(expiresOn)}`
}

export function shelfDays(ingredient: Ingredient, storage: Storage): number | null {
  return {
    pantry: ingredient.shelf_days_pantry,
    fridge: ingredient.shelf_days_fridge,
    freezer: ingredient.shelf_days_freezer,
  }[storage]
}

/** Where an ingredient usually lives: the pantry if it keeps there, else the fridge. */
export function defaultStorage(ingredient: Ingredient): Storage {
  if (ingredient.shelf_days_pantry !== null) return 'pantry'
  if (ingredient.shelf_days_fridge !== null) return 'fridge'
  if (ingredient.shelf_days_freezer !== null) return 'freezer'
  return 'pantry'
}

export function tagLabel(name: string): string {
  return titleCase(name.replace(/-/g, ' '))
}
