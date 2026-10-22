import { apiFetch } from './client'

// Mirrors backend/app/schemas/cook_log.py
export interface Usage {
  pantry_item_id: number
  ingredient_name: string
  quantity_used: number | null
  unit: string | null
}

export interface CookLog {
  id: number
  recipe_id: number
  recipe_title: string
  servings_made: number
  cooked_by: string | null
  cooked_at: string
  usages: Usage[]
}

export interface CookLogCreate {
  recipe_id: number
  servings_made?: number
}

export const cookLogKeys = {
  all: ['cook-logs'] as const,
}

export function listCookLogs(): Promise<CookLog[]> {
  return apiFetch<CookLog[]>('/cook-logs')
}

export function logCook(data: CookLogCreate): Promise<CookLog> {
  return apiFetch<CookLog>('/cook-logs', { method: 'POST', body: JSON.stringify(data) })
}

export function undoCookLog(id: number): Promise<null> {
  return apiFetch<null>(`/cook-logs/${id}`, { method: 'DELETE' })
}
