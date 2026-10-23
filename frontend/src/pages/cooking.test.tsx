import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  db,
  garlicChicken,
  ingredients,
  omelette,
  pantryItem,
  recommendation,
  requestsTo,
  tags,
} from '../test/db'
import { renderApp } from '../test/render'
import { API, server } from '../test/server'

describe('WhatCanIMakePage', () => {
  it('asks for pantry items when the pantry is empty', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Your pantry is empty' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stock your pantry' })).toHaveAttribute(
      'href',
      '/pantry',
    )
  })

  it('lists ranked suggestions with coverage, urgency and the shopping hint', async () => {
    db.pantry = [pantryItem({ ingredient: ingredients.egg })]
    db.recommendations = [
      recommendation(omelette, { expiring: ['spinach'], score: 0.775 }),
      recommendation(garlicChicken, {
        coverage: 0.5,
        have_count: 1,
        missing: ['lemon'],
        score: 0.35,
      }),
    ]
    renderApp('/')

    const list = await screen.findByRole('list', { name: 'Suggested recipes' })
    const [first, second] = within(list).getAllByRole('listitem')
    expect(first).toHaveTextContent('Number 1: Spinach & Cheddar Omelette')
    expect(first).toHaveTextContent('Ready')
    expect(first).toHaveTextContent('Uses soon: Spinach')
    expect(within(first).getByRole('link')).toHaveAttribute('href', '/recipes/1')
    expect(second).toHaveTextContent('1 missing')
    expect(second).toHaveTextContent('Need: Lemon')
    expect(within(second).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('1 suggestion uses something that expires soon.')).toBeInTheDocument()
  })

  it('filters by how many ingredients are missing', async () => {
    db.pantry = [pantryItem({ ingredient: ingredients.egg })]
    db.recommendations = [recommendation(garlicChicken, { missing: ['lemon'] })]
    const { user } = renderApp('/')
    await screen.findByRole('list', { name: 'Suggested recipes' })

    await user.click(screen.getByRole('radio', { name: 'Ready now' }))

    expect(await screen.findByRole('heading', { name: 'Nothing matches yet' })).toBeInTheDocument()
    expect(requestsTo('GET', '/recipes/recommendations').length).toBeGreaterThanOrEqual(2)
    await user.click(screen.getByRole('button', { name: 'Show all suggestions' }))
    expect(await screen.findByText('Garlic Butter Chicken')).toBeInTheDocument()
  })

  it('shows active diet filters with a link to change them', async () => {
    db.pantry = [pantryItem({ ingredient: ingredients.egg })]
    db.prefs = [
      { tag: tags.vegetarian, mode: 'require' },
      { tag: tags.nuts, mode: 'avoid' },
    ]
    renderApp('/')

    const link = await screen.findByRole('link', { name: 'Vegetarian · Avoid nuts' })
    expect(link).toHaveAttribute('href', '/settings')
  })

  it('reports an API failure', async () => {
    db.pantry = [pantryItem({ ingredient: ingredients.egg })]
    server.use(http.get(`${API}/recipes/recommendations`, () => HttpResponse.error()))
    renderApp('/')

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load suggestions")
  })
})

describe('RecipeDetailPage', () => {
  it('marks each ingredient as in the pantry, missing, optional or a staple', async () => {
    renderApp('/recipes/1')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Spinach & Cheddar Omelette' }),
    ).toBeInTheDocument()
    const section = screen.getByRole('heading', { name: 'Ingredients' }).closest('section')!
    const lines = within(section)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(lines).toEqual([
      '3 eggs (in your pantry)',
      '1 cup fresh spinach (missing)',
      '2 tbsp milk (optional) (missing)optional',
      'Salt, to taste (staple)staple',
    ])
    // Only eggs and spinach count: milk is optional and salt is a staple.
    expect(screen.getByText('You have 1 of 2')).toBeInTheDocument()
    expect(screen.getByText(/Step 3:/).parentElement).toHaveTextContent('Step 3: Cook until set.')
    expect(screen.getByText('Vegetarian')).toBeInTheDocument()
  })

  it('logs a meal, then undoes it from the toast', async () => {
    const { user } = renderApp('/recipes/2')
    await user.click(await screen.findByRole('button', { name: 'I cooked this' }))

    const sheet = screen.getByRole('dialog', { name: 'Log this meal' })
    const servings = within(sheet).getByRole('status')
    expect(servings).toHaveTextContent('2')
    await user.click(within(sheet).getByRole('button', { name: 'More servings' }))
    expect(servings).toHaveTextContent('3')
    await user.click(within(sheet).getByRole('button', { name: 'Log meal & update pantry' }))

    const toast = await screen.findByText('Logged! Used 3 egg, Spinach.')
    expect(requestsTo('POST', '/cook-logs')[0].body).toEqual({ recipe_id: 2, servings_made: 3 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(within(toast.parentElement!).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(requestsTo('DELETE', '/cook-logs/900')).toHaveLength(1))
  })

  it('never goes below one serving', async () => {
    const { user } = renderApp('/recipes/1')
    await user.click(await screen.findByRole('button', { name: 'I cooked this' }))

    expect(screen.getByRole('button', { name: 'Fewer servings' })).toBeDisabled()
  })

  it('shows not found for an unknown recipe', async () => {
    renderApp('/recipes/12345')
    expect(await screen.findByRole('heading', { name: 'Recipe not found' })).toBeInTheDocument()
    const back = within(screen.getByRole('main')).getByRole('link', { name: 'Recipes' })
    expect(back).toHaveAttribute('href', '/recipes')
  })
})

describe('RecipesPage', () => {
  it('searches by name through the URL', async () => {
    const { user, router } = renderApp('/recipes')
    expect(await screen.findByRole('heading', { name: '2 recipes' })).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search recipes' }), 'omelette')

    await waitFor(() => expect(router.state.location.search).toBe('?q=omelette'))
    expect(await screen.findByRole('heading', { name: '1 recipe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Omelette/ })).toHaveAttribute('href', '/recipes/1')
  })

  it('filters by diet tag and toggles the filter off', async () => {
    const { user } = renderApp('/recipes')
    await screen.findByRole('heading', { name: '2 recipes' })
    const vegetarian = screen.getByRole('button', { name: 'Vegetarian' })

    await user.click(vegetarian)
    expect(vegetarian).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: '1 recipe' })).toBeInTheDocument()

    await user.click(vegetarian)
    expect(await screen.findByRole('heading', { name: '2 recipes' })).toBeInTheDocument()
    // Allergen tags aren't offered as browse filters.
    expect(screen.queryByRole('button', { name: /Nuts/ })).not.toBeInTheDocument()
  })

  it('keeps a diet filter picked while a search change is still pending', async () => {
    const { user, router } = renderApp('/recipes?q=omelette')
    await screen.findByRole('heading', { name: '1 recipe' })

    // Inside the 250 ms debounce: the click writes the pending search and the tag together.
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await user.click(screen.getByRole('button', { name: 'Vegetarian' }))
    expect(router.state.location.search).toBe('?tag=1')

    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(router.state.location.search).toBe('?tag=1')
    expect(screen.getByRole('button', { name: 'Vegetarian' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('has an empty state', async () => {
    renderApp('/recipes?q=zzz')
    expect(await screen.findByRole('heading', { name: 'No recipes found' })).toBeInTheDocument()
  })
})

describe('HistoryPage', () => {
  it('has an empty state', async () => {
    renderApp('/history')
    expect(await screen.findByRole('heading', { name: 'No meals logged yet' })).toBeInTheDocument()
  })

  it('lists meals and undoes one', async () => {
    db.cookLogs = [
      {
        id: 41,
        recipe_id: 1,
        recipe_title: 'Spinach & Cheddar Omelette',
        servings_made: 1,
        cooked_by: 'Ben',
        cooked_at: '2026-03-01T18:30:00',
        usages: [{ pantry_item_id: 1, ingredient_name: 'egg', quantity_used: 3, unit: null }],
      },
    ]
    const { user } = renderApp('/history')

    expect(await screen.findByText(/1 serving · Ben/)).toBeInTheDocument()
    expect(screen.getByText('Used 3 egg')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo Spinach & Cheddar Omelette' }))

    expect(
      await screen.findByText('Undid Spinach & Cheddar Omelette. Pantry restored.'),
    ).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'No meals logged yet' })).toBeInTheDocument()
  })
})
