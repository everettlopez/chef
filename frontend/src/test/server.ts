/** A fake Chef API for component tests, backed by the in-memory `db`. */
import { delay, http, HttpResponse, type HttpResponseResolver, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'
import type { CookLog, CookLogCreate } from '../api/cookLogs'
import type { PantryItem, PantryItemCreate, PantryItemUpdate } from '../api/pantry'
import { db, me, PASSWORD } from './db'

export const API = 'http://localhost:3000/api'

const unauthorized = () => HttpResponse.json({ detail: 'Not signed in' }, { status: 401 })
const notFound = (what: string) =>
  HttpResponse.json({ detail: `${what} not found` }, { status: 404 })

/** Wraps a handler: records the request and answers 401 when signed out. */
function api<P extends Record<string, string>>(
  handler: (args: { params: P; body: unknown; url: URL }) => Response | Promise<Response>,
  { auth = true } = {},
): HttpResponseResolver<P> {
  return async ({ request, params }) => {
    const url = new URL(request.url)
    const text = request.method === 'GET' ? '' : await request.text()
    const body: unknown = text ? JSON.parse(text) : null
    db.requests.push({ method: request.method, path: url.pathname.replace('/api', ''), body })
    if (auth && !db.user) return unauthorized()
    return handler({ params, body, url })
  }
}

const json = (data: JsonBodyType, status = 200) => HttpResponse.json(data, { status })

export const handlers = [
  http.get(
    `${API}/health`,
    api(() => json({ status: 'ok', database: 'ok' }), { auth: false }),
  ),

  http.get(
    `${API}/auth/me`,
    api(() => json(db.user)),
  ),
  http.post(
    `${API}/auth/login`,
    api(
      ({ body }) => {
        const { email, password } = body as { email: string; password: string }
        if (email.trim().toLowerCase() !== me.email || password !== PASSWORD)
          return json({ detail: 'Incorrect email or password' }, 401)
        db.user = me
        return json(me)
      },
      { auth: false },
    ),
  ),
  http.post(
    `${API}/auth/signup`,
    api(
      ({ body }) => {
        const { email, display_name } = body as { email: string; display_name: string }
        if (email === me.email)
          return json({ detail: 'An account with that email already exists' }, 409)
        db.user = { id: 8, email, display_name }
        return json(db.user, 201)
      },
      { auth: false },
    ),
  ),
  http.post(
    `${API}/auth/logout`,
    api(
      () => {
        db.user = null
        return new HttpResponse(null, { status: 204 })
      },
      { auth: false },
    ),
  ),

  http.get(
    `${API}/household`,
    api(() => json(db.household)),
  ),
  http.patch(
    `${API}/household`,
    api(({ body }) => {
      db.household = { ...db.household, name: (body as { name: string }).name }
      return json(db.household)
    }),
  ),
  http.post(
    `${API}/household/invite-code`,
    api(() => {
      db.household = { ...db.household, invite_code: 'XYZW6789' }
      return json(db.household)
    }),
  ),
  http.post(
    `${API}/household/join`,
    api(({ body }) => {
      const code = (body as { invite_code: string }).invite_code
      if (code !== 'FRIEND22') return json({ detail: 'No household has that invite code' }, 404)
      db.household = { ...db.household, id: 2, name: "Friend's Flat", invite_code: code }
      db.pantry = []
      return json(db.household)
    }),
  ),

  http.get(
    `${API}/ingredients`,
    api(({ url }) => {
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      return json(db.ingredients.filter((i) => i.canonical_name.includes(q)))
    }),
  ),

  http.get(
    `${API}/pantry`,
    api(() => json(db.pantry.filter((i) => i.status === 'active'))),
  ),
  http.post(
    `${API}/pantry`,
    api(({ body }) => {
      const data = body as PantryItemCreate
      const ingredient =
        db.ingredients.find((i) => i.id === data.ingredient_id) ??
        db.ingredients.find((i) => i.canonical_name === data.name?.toLowerCase())
      if (!ingredient) return json({ detail: [{ msg: 'Value error, Unknown ingredient' }] }, 422)
      const item: PantryItem = {
        id: 500 + db.pantry.length,
        ingredient,
        quantity: data.quantity ?? null,
        unit: data.unit ?? null,
        storage: data.storage,
        purchased_on: '2026-01-01',
        expires_on: data.expires_on ?? null,
        expiry_estimated: !data.expires_on,
        status: 'active',
      }
      db.pantry.push(item)
      return json(item, 201)
    }),
  ),
  http.patch(
    `${API}/pantry/:id`,
    api<{ id: string }>(({ params, body }) => {
      const item = db.pantry.find((i) => i.id === Number(params.id))
      if (!item) return notFound('Pantry item')
      const { use_estimate: _, ...changes } = body as PantryItemUpdate
      Object.assign(item, changes)
      return json(item)
    }),
  ),
  http.delete(
    `${API}/pantry/:id`,
    api<{ id: string }>(({ params }) => {
      const item = db.pantry.find((i) => i.id === Number(params.id))
      if (!item) return notFound('Pantry item')
      item.status = 'discarded'
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    `${API}/recipes/recommendations`,
    api(({ url }) => {
      const max = url.searchParams.get('max_missing')
      return json(db.recommendations.filter((r) => max === null || r.missing.length <= Number(max)))
    }),
  ),
  http.get(
    `${API}/recipes`,
    api(({ url }) => {
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const tag = url.searchParams.get('tag_id')
      return json(
        db.recipes
          .filter((r) => r.title.toLowerCase().includes(q))
          .filter((r) => !tag || r.tags.some((t) => t.id === Number(tag)))
          .map(({ instructions: _i, ingredients: _l, ...summary }) => summary),
      )
    }),
  ),
  http.get(
    `${API}/recipes/:id`,
    api<{ id: string }>(({ params }) => {
      const recipe = db.recipes.find((r) => r.id === Number(params.id))
      return recipe ? json(recipe) : notFound('Recipe')
    }),
  ),

  http.get(
    `${API}/dietary-tags`,
    api(() => json(db.tags)),
  ),
  http.get(
    `${API}/me/diet-prefs`,
    api(() => json(db.prefs)),
  ),
  http.put(
    `${API}/me/diet-prefs`,
    api(async ({ body }) => {
      await delay(20)
      const { prefs } = body as { prefs: { tag_id: number; mode: 'require' | 'avoid' }[] }
      db.prefs = prefs.map((p) => ({ tag: db.tags.find((t) => t.id === p.tag_id)!, mode: p.mode }))
      return json(db.prefs)
    }),
  ),

  http.get(
    `${API}/cook-logs`,
    api(() => json(db.cookLogs)),
  ),
  http.post(
    `${API}/cook-logs`,
    api(({ body }) => {
      const data = body as CookLogCreate
      const recipe = db.recipes.find((r) => r.id === data.recipe_id)
      if (!recipe) return notFound('Recipe')
      const log: CookLog = {
        id: 900 + db.cookLogs.length,
        recipe_id: recipe.id,
        recipe_title: recipe.title,
        servings_made: data.servings_made ?? recipe.servings,
        cooked_by: db.user!.display_name,
        cooked_at: '2026-03-01T18:30:00',
        usages: [
          { pantry_item_id: 1, ingredient_name: 'egg', quantity_used: 3, unit: null },
          { pantry_item_id: 2, ingredient_name: 'spinach', quantity_used: null, unit: 'cup' },
        ],
      }
      db.cookLogs.unshift(log)
      return json(log, 201)
    }),
  ),
  http.delete(
    `${API}/cook-logs/:id`,
    api<{ id: string }>(({ params }) => {
      const before = db.cookLogs.length
      db.cookLogs = db.cookLogs.filter((l) => l.id !== Number(params.id))
      return db.cookLogs.length < before
        ? new HttpResponse(null, { status: 204 })
        : notFound('Cook log')
    }),
  ),
]

export const server = setupServer(...handlers)
