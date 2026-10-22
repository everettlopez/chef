import { Clock, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState, ErrorBanner, ListSkeleton, PageHeader } from '../components/ui/Feedback'
import { List, ListRow } from '../components/ui/List'
import { SearchField } from '../components/ui/SearchField'
import { useDietaryTags, useRecipes } from '../hooks/useRecipes'
import { cn } from '../lib/cn'
import { formatMinutes, tagLabel } from '../lib/format'

export function RecipesPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const tagId = params.get('tag') ? Number(params.get('tag')) : undefined
  const [text, setText] = useState(q)
  const tags = useDietaryTags()
  const recipes = useRecipes({ q: q || undefined, tag_id: tagId })

  // Debounce typing into the URL so search is shareable and survives reloads.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (text.trim()) next.set('q', text.trim())
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [text, setParams])

  function toggleTag(id: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (tagId === id) next.delete('tag')
      else next.set('tag', String(id))
      return next
    })
  }

  const dietTags = tags.data?.filter((t) => t.kind === 'diet') ?? []

  return (
    <>
      <PageHeader title="Recipes" subtitle="Browse and search the Chef collection." />

      <SearchField
        label="Search recipes"
        placeholder="Search by name or ingredient"
        value={text}
        onChange={setText}
        className="mb-3"
      />
      <div
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
        role="group"
        aria-label="Filter by diet"
      >
        {dietTags.map((tag) => {
          const selected = tag.id === tagId
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                'min-h-11 shrink-0 rounded-full px-4 text-subhead font-medium transition-colors',
                selected
                  ? 'bg-brand text-on-brand'
                  : 'bg-surface text-label shadow-card hover:bg-fill',
              )}
            >
              {tagLabel(tag.name)}
            </button>
          )
        })}
      </div>

      {recipes.isPending && <ListSkeleton rows={6} />}
      {recipes.isError && <ErrorBanner>Couldn't load recipes.</ErrorBanner>}
      {recipes.data && recipes.data.length === 0 && (
        <EmptyState
          icon={<SearchX />}
          title="No recipes found"
          message="Try a different name or ingredient, or clear the diet filter."
        />
      )}
      {recipes.data && recipes.data.length > 0 && (
        <List
          header={`${recipes.data.length} recipe${recipes.data.length === 1 ? '' : 's'}`}
          className={cn(recipes.isPlaceholderData && 'opacity-60 transition-opacity')}
        >
          {recipes.data.map((recipe) => {
            const time = formatMinutes(recipe.prep_min, recipe.cook_min)
            const diet = recipe.tags.filter((t) => t.kind === 'diet').map((t) => tagLabel(t.name))
            return (
              <ListRow
                key={recipe.id}
                to={`/recipes/${recipe.id}`}
                title={recipe.title}
                subtitle={
                  <span className="flex flex-wrap items-center gap-x-2">
                    {time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock aria-hidden className="size-3.5" />
                        {time}
                      </span>
                    )}
                    {diet.length > 0 && <span>{diet.join(' · ')}</span>}
                  </span>
                }
              />
            )
          })}
        </List>
      )}
    </>
  )
}
