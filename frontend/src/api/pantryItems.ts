import { apiFetch } from './client'

// Mirrors backend/app/schemas/pantry_item.py
export interface PantryItem {
  id: number
  name: string
  quantity: number
  unit: string | null
  created_at: string
  updated_at: string
}

export interface PantryItemCreate {
  name: string
  quantity: number
  unit?: string | null
}

export const pantryItemKeys = {
  all: ['pantry-items'] as const,
}

export function listPantryItems(): Promise<PantryItem[]> {
  return apiFetch<PantryItem[]>('/pantry-items')
}

export function createPantryItem(data: PantryItemCreate): Promise<PantryItem> {
  return apiFetch<PantryItem>('/pantry-items', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
