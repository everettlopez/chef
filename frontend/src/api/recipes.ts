import { apiFetch } from './client'

// Mirrors backend/app/schemas/recipe.py
export interface Tag {
  id: number
  name: string
  kind: 'diet' | 'allergen'
}

export interface RecipeSummary {
  id: number
  title: string
  description: string | null
  prep_min: number | null
  cook_min: number | null
  servings: number
  tags: Tag[]
}

export interface RecipeIngredient {
  id: number
  raw_text: string
  quantity: number | null
  unit: string | null
  optional: boolean
  ingredient_id: number | null
  ingredient_name: string | null
  staple: boolean
  in_pantry: boolean
}

export interface RecipeDetail extends RecipeSummary {
  instructions: string
  ingredients: RecipeIngredient[]
}

export interface Recommendation {
  recipe: RecipeSummary
  score: number
  coverage: number
  have_count: number
  required_count: number
  missing: string[]
  expiring: string[]
}

export interface DietPref {
  tag: Tag
  mode: 'require' | 'avoid'
}

export interface RecipeFilters {
  q?: string
  tag_id?: number
}

export const recipeKeys = {
  all: ['recipes'] as const,
  list: (filters: RecipeFilters) => ['recipes', 'list', filters] as const,
  detail: (id: number) => ['recipes', 'detail', id] as const,
  recommendations: (maxMissing: number | null) =>
    ['recipes', 'recommendations', maxMissing] as const,
}

export const dietKeys = {
  tags: ['diet', 'tags'] as const,
  prefs: ['diet', 'prefs'] as const,
}

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function listRecipes(filters: RecipeFilters): Promise<RecipeSummary[]> {
  return apiFetch<RecipeSummary[]>(`/recipes${query({ ...filters, limit: 100 })}`)
}

export function getRecipe(id: number): Promise<RecipeDetail> {
  return apiFetch<RecipeDetail>(`/recipes/${id}`)
}

export function getRecommendations(maxMissing: number | null): Promise<Recommendation[]> {
  return apiFetch<Recommendation[]>(`/recipes/recommendations${query({ max_missing: maxMissing })}`)
}

export function listDietaryTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>('/dietary-tags')
}

export function getDietPrefs(): Promise<DietPref[]> {
  return apiFetch<DietPref[]>('/me/diet-prefs')
}

export function setDietPrefs(prefs: { tag_id: number; mode: 'require' | 'avoid' }[]) {
  return apiFetch<DietPref[]>('/me/diet-prefs', {
    method: 'PUT',
    body: JSON.stringify({ prefs }),
  })
}
