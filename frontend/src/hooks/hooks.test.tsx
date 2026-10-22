import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { authKeys } from '../api/auth'
import { cookLogKeys } from '../api/cookLogs'
import { householdKeys } from '../api/household'
import { pantryKeys } from '../api/pantry'
import { dietKeys, recipeKeys } from '../api/recipes'
import { db, ingredients, tags } from '../test/db'
import { Providers, testQueryClient } from '../test/render'
import { useLogin, useLogout } from './useAuth'
import { useLogCook, useUndoCookLog } from './useCookLogs'
import { useJoinHousehold } from './useHousehold'
import { useCreatePantryItem, useIngredientSearch } from './usePantry'
import { useDietPrefs, useToggleDietPref } from './useRecipes'

function setup() {
  const client = testQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers client={client}>{children}</Providers>
  )
  return { client, wrapper }
}

/** Seed a query so we can see whether a mutation invalidated it. */
function seed(client: ReturnType<typeof testQueryClient>, key: readonly unknown[]) {
  client.setQueryData(key, [])
  return () => client.getQueryState(key)?.isInvalidated
}

describe('useToggleDietPref', () => {
  it('keeps every toggle when several fire at once', async () => {
    const { client, wrapper } = setup()
    const { result } = renderHook(() => ({ prefs: useDietPrefs(), toggle: useToggleDietPref() }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.prefs.isSuccess).toBe(true))

    await act(async () => {
      result.current.toggle.mutate({ tag: tags.vegetarian, on: true })
      result.current.toggle.mutate({ tag: tags.vegan, on: true })
      result.current.toggle.mutate({ tag: tags.nuts, on: true })
      await new Promise((resolve) => setTimeout(resolve, 5)) // each PUT takes 20 ms
    })

    // The switches flip right away, while the saves are still queued...
    expect(client.getQueryData(dietKeys.prefs)).toHaveLength(3)
    expect(db.requests.filter((r) => r.method === 'PUT')).toHaveLength(1)
    await waitFor(() => expect(client.isMutating()).toBe(0))

    // ...the server ends up with all three, and allergens are saved as "avoid".
    expect(db.prefs.map((p) => [p.tag.name, p.mode])).toEqual([
      ['vegetarian', 'require'],
      ['vegan', 'require'],
      ['contains-nuts', 'avoid'],
    ])
    await waitFor(() => expect(result.current.prefs.data).toHaveLength(3))
    const puts = db.requests.filter((r) => r.method === 'PUT')
    expect(puts).toHaveLength(3) // one at a time, in order
  })

  it('turning one off leaves the others', async () => {
    db.prefs = [
      { tag: tags.vegetarian, mode: 'require' },
      { tag: tags.nuts, mode: 'avoid' },
    ]
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ prefs: useDietPrefs(), toggle: useToggleDietPref() }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.prefs.data).toHaveLength(2))

    await act(() => result.current.toggle.mutateAsync({ tag: tags.vegetarian, on: false }))

    expect(db.prefs.map((p) => p.tag.name)).toEqual(['contains-nuts'])
  })

  it('refreshes recommendations after saving', async () => {
    const { client, wrapper } = setup()
    const invalidated = seed(client, recipeKeys.recommendations(null))
    const { result } = renderHook(() => useToggleDietPref(), { wrapper })

    await act(() => result.current.mutateAsync({ tag: tags.vegan, on: true }))

    expect(invalidated()).toBe(true)
  })
})

describe('cache invalidation', () => {
  it('adding to the pantry refreshes the pantry and recipe coverage', async () => {
    const { client, wrapper } = setup()
    const pantry = seed(client, pantryKeys.all)
    const recs = seed(client, recipeKeys.recommendations(1))
    const detail = seed(client, recipeKeys.detail(1))
    const { result } = renderHook(() => useCreatePantryItem(), { wrapper })

    await act(() =>
      result.current.mutateAsync({ ingredient_id: ingredients.milk.id, storage: 'fridge' }),
    )

    expect([pantry(), recs(), detail()]).toEqual([true, true, true])
  })

  it('cooking and undoing refresh history, pantry and recipes', async () => {
    const { client, wrapper } = setup()
    const { result } = renderHook(() => ({ cook: useLogCook(), undo: useUndoCookLog() }), {
      wrapper,
    })

    const seedAll = () =>
      [cookLogKeys.all, pantryKeys.all, recipeKeys.all].map((k) => seed(client, k))
    let checks = seedAll()
    const log = await act(() => result.current.cook.mutateAsync({ recipe_id: 1 }))
    expect(checks.map((c) => c())).toEqual([true, true, true])

    checks = seedAll()
    await act(() => result.current.undo.mutateAsync(log.id))
    expect(checks.map((c) => c())).toEqual([true, true, true])
  })

  it('joining a household refreshes everything', async () => {
    const { client, wrapper } = setup()
    const household = seed(client, householdKeys.all)
    const pantry = seed(client, pantryKeys.all)
    const { result } = renderHook(() => useJoinHousehold(), { wrapper })

    await act(() => result.current.mutateAsync('FRIEND22'))

    expect([household(), pantry()]).toEqual([true, true])
  })
})

describe('auth', () => {
  it('login starts from a clean cache with the new user', async () => {
    db.user = null
    const { client, wrapper } = setup()
    client.setQueryData(pantryKeys.all, ['someone else’s items'])
    const { result } = renderHook(() => useLogin(), { wrapper })

    await act(() =>
      result.current.mutateAsync({ email: 'cook@example.com', password: 'correct-horse' }),
    )

    expect(client.getQueryData(pantryKeys.all)).toBeUndefined()
    expect(client.getQueryData(authKeys.me)).toMatchObject({ email: 'cook@example.com' })
  })

  it('logout clears the cache even if the request fails', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(pantryKeys.all, ['items'])
    const { result } = renderHook(() => useLogout(), { wrapper })

    await act(() => result.current.mutateAsync())

    expect(client.getQueryData(pantryKeys.all)).toBeUndefined()
    expect(client.getQueryData(authKeys.me)).toBeNull()
  })
})

describe('useIngredientSearch', () => {
  it('skips blank queries and shares a cache across case', async () => {
    const { wrapper } = setup()
    const { result, rerender } = renderHook(({ q }) => useIngredientSearch(q), {
      wrapper,
      initialProps: { q: '   ' },
    })
    expect(result.current.fetchStatus).toBe('idle')

    rerender({ q: 'Milk' })
    await waitFor(() => expect(result.current.data?.[0]?.canonical_name).toBe('milk'))
    rerender({ q: 'milk ' })

    expect(db.requests.filter((r) => r.path === '/ingredients')).toHaveLength(1)
  })
})
