/**
 * In-memory state behind the MSW handlers. Typed with the app's own API types, so a schema
 * change that isn't mirrored here fails the type check. `resetDb()` runs before every test.
 */
import type { User } from '../api/auth'
import type { CookLog } from '../api/cookLogs'
import type { Household } from '../api/household'
import type { Ingredient, PantryItem } from '../api/pantry'
import type { DietPref, RecipeDetail, Recommendation, Tag } from '../api/recipes'
import { addDays, todayISO } from '../lib/format'

export const PASSWORD = 'correct-horse'

export const ingredients = {
  milk: ingredient(1, 'milk', 'dairy', 'gallon', 1, 7, 90),
  spinach: ingredient(2, 'spinach', 'produce', 'cup', null, 5, 240),
  chicken: ingredient(3, 'chicken breast', 'meat', 'lb', null, 2, 270),
  rice: ingredient(4, 'rice', 'grain', 'cup', 730, null, null),
  egg: ingredient(5, 'egg', 'dairy', null, null, 35, null),
}

export const tags: Record<string, Tag> = {
  vegetarian: { id: 1, name: 'vegetarian', kind: 'diet' },
  vegan: { id: 2, name: 'vegan', kind: 'diet' },
  nuts: { id: 5, name: 'contains-nuts', kind: 'allergen' },
}

function ingredient(
  id: number,
  canonical_name: string,
  category: string,
  default_unit: string | null,
  shelf_days_pantry: number | null,
  shelf_days_fridge: number | null,
  shelf_days_freezer: number | null,
): Ingredient {
  return {
    id,
    canonical_name,
    category,
    default_unit,
    shelf_days_pantry,
    shelf_days_fridge,
    shelf_days_freezer,
  }
}

export const me: User = { id: 7, email: 'cook@example.com', display_name: 'Cook' }

export function pantryItem(
  overrides: Partial<PantryItem> & { ingredient: Ingredient },
): PantryItem {
  return {
    id: 100 + Math.floor(Math.random() * 1_000_000),
    quantity: null,
    unit: null,
    storage: 'fridge',
    purchased_on: todayISO(),
    expires_on: addDays(todayISO(), 10),
    expiry_estimated: true,
    status: 'active',
    ...overrides,
  }
}

export const omelette: RecipeDetail = {
  id: 1,
  title: 'Spinach & Cheddar Omelette',
  description: 'A fluffy weeknight omelette.',
  prep_min: 5,
  cook_min: 5,
  servings: 1,
  tags: [tags.vegetarian],
  instructions: 'Whisk the eggs.\nWilt the spinach.\nCook until set.',
  ingredients: [
    line(11, '3 eggs', 5, 'egg', { in_pantry: true }),
    line(12, '1 cup fresh spinach', 2, 'spinach', { in_pantry: false }),
    line(13, '2 tbsp milk (optional)', 1, 'milk', { optional: true }),
    line(14, 'Salt, to taste', 99, 'salt', { staple: true, optional: true }),
  ],
}

export const garlicChicken: RecipeDetail = {
  id: 2,
  title: 'Garlic Butter Chicken',
  description: null,
  prep_min: 10,
  cook_min: 70,
  servings: 2,
  tags: [],
  instructions: 'Sear the chicken.',
  ingredients: [line(21, '1 lb chicken breast', 3, 'chicken breast', { in_pantry: true })],
}

function line(
  id: number,
  raw_text: string,
  ingredient_id: number,
  ingredient_name: string,
  flags: Partial<{ optional: boolean; staple: boolean; in_pantry: boolean }>,
): RecipeDetail['ingredients'][number] {
  return {
    id,
    raw_text,
    quantity: null,
    unit: null,
    optional: false,
    staple: false,
    in_pantry: false,
    ingredient_id,
    ingredient_name,
    ...flags,
  }
}

export function recommendation(
  recipe: RecipeDetail,
  overrides: Partial<Recommendation> = {},
): Recommendation {
  const { instructions: _i, ingredients: _l, ...summary } = recipe
  return {
    recipe: summary,
    score: 0.7,
    coverage: 1,
    have_count: 2,
    required_count: 2,
    missing: [],
    expiring: [],
    ...overrides,
  }
}

export interface RecordedRequest {
  method: string
  path: string
  body: unknown
}

interface Db {
  user: User | null
  household: Household
  pantry: PantryItem[]
  ingredients: Ingredient[]
  tags: Tag[]
  recipes: RecipeDetail[]
  recommendations: Recommendation[]
  prefs: DietPref[]
  cookLogs: CookLog[]
  requests: RecordedRequest[]
}

export const db = {} as Db

export function resetDb(): void {
  Object.assign(db, {
    user: me,
    household: {
      id: 1,
      name: "Cook's Kitchen",
      invite_code: 'ABCD2345',
      members: [{ user_id: me.id, display_name: 'Cook', email: me.email, role: 'owner' }],
    },
    pantry: [],
    ingredients: Object.values(ingredients),
    tags: Object.values(tags),
    recipes: [omelette, garlicChicken],
    recommendations: [],
    prefs: [],
    cookLogs: [],
    requests: [],
  } satisfies Db)
}

/** Requests the app made, e.g. `requestsTo('DELETE', '/cook-logs/9')`. */
export function requestsTo(method: string, path: string): RecordedRequest[] {
  return db.requests.filter((r) => r.method === method && r.path === path)
}
