import { apiFetch } from './client'

// Mirrors backend/app/schemas/pantry_item.py
export type Storage = 'pantry' | 'fridge' | 'freezer'
export type PantryStatus = 'active' | 'used' | 'discarded'

export interface Ingredient {
  id: number
  canonical_name: string
  category: string
  default_unit: string | null
  shelf_days_pantry: number | null
  shelf_days_fridge: number | null
  shelf_days_freezer: number | null
}

export interface PantryItem {
  id: number
  ingredient: Ingredient
  quantity: number | null
  unit: string | null
  storage: Storage
  purchased_on: string
  expires_on: string | null
  expiry_estimated: boolean
  status: PantryStatus
}

export interface PantryItemCreate {
  ingredient_id?: number
  name?: string
  quantity?: number | null
  unit?: string | null
  storage: Storage
  purchased_on?: string
  expires_on?: string | null
}

export interface PantryItemUpdate {
  quantity?: number | null
  unit?: string | null
  storage?: Storage
  purchased_on?: string
  expires_on?: string
  use_estimate?: boolean
  status?: PantryStatus
}

export const pantryKeys = {
  all: ['pantry'] as const,
}

export const ingredientKeys = {
  search: (q: string) => ['ingredients', 'search', q] as const,
}

export function listPantryItems(): Promise<PantryItem[]> {
  return apiFetch<PantryItem[]>('/pantry')
}

export function createPantryItem(data: PantryItemCreate): Promise<PantryItem> {
  return apiFetch<PantryItem>('/pantry', { method: 'POST', body: JSON.stringify(data) })
}

export function updatePantryItem(id: number, data: PantryItemUpdate): Promise<PantryItem> {
  return apiFetch<PantryItem>(`/pantry/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function discardPantryItem(id: number): Promise<null> {
  return apiFetch<null>(`/pantry/${id}`, { method: 'DELETE' })
}

export function searchIngredients(q: string): Promise<Ingredient[]> {
  return apiFetch<Ingredient[]>(`/ingredients?${new URLSearchParams({ q })}`)
}
