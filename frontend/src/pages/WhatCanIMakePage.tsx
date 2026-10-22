import {
  Clock,
  Filter,
  Hourglass,
  Refrigerator,
  ShoppingBasket,
  Sparkles,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { Recommendation } from '../api/recipes'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState, ErrorBanner, PageHeader, Skeleton } from '../components/ui/Feedback'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { useMe } from '../hooks/useAuth'
import { usePantryItems } from '../hooks/usePantry'
import { useDietPrefs, useRecommendations } from '../hooks/useRecipes'
import { dietPrefLabel, formatMinutes, tagLabel, titleCase } from '../lib/format'

type MissingFilter = 'any' | '0' | '1' | '2'

const missingOptions: { value: MissingFilter; label: string }[] = [
  { value: 'any', label: 'All' },
  { value: '0', label: 'Ready now' },
  { value: '1', label: '≤1 missing' },
  { value: '2', label: '≤2 missing' },
]

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function WhatCanIMakePage() {
  const [filter, setFilter] = useState<MissingFilter>('any')
  const maxMissing = filter === 'any' ? null : Number(filter)
  const { data: user } = useMe()
  const pantry = usePantryItems()
  const recommendations = useRecommendations(maxMissing)
  const prefs = useDietPrefs()

  const pantryEmpty = pantry.data?.length === 0
  const expiringCount =
    recommendations.data?.reduce((n, r) => n + (r.expiring.length > 0 ? 1 : 0), 0) ?? 0

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="text-subhead font-medium text-label-secondary">
            {greeting()}
            {user ? `, ${user.display_name}` : ''}
          </span>
        }
        title="What can I make?"
        subtitle="Recipes ranked by what's in your pantry — and what expires soonest."
      />

      {pantryEmpty ? (
        <EmptyState
          icon={<Refrigerator />}
          title="Your pantry is empty"
          message="Add a few things you have on hand and Chef will suggest recipes that use them."
          action={<ButtonLink to="/pantry">Stock your pantry</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl
              label="Missing ingredients"
              options={missingOptions}
              value={filter}
              onChange={setFilter}
              className="sm:w-[26rem]"
            />
            {prefs.data && prefs.data.length > 0 && (
              <Link
                to="/settings"
                className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl px-2 text-subhead text-label-secondary hover:bg-fill sm:self-auto"
              >
                <Filter aria-hidden className="size-4" />
                {prefs.data.map((p) => dietPrefLabel(p.tag)).join(' · ')}
              </Link>
            )}
          </div>

          {recommendations.isError && (
            <ErrorBanner>Couldn't load suggestions. Check that the API is running.</ErrorBanner>
          )}

          {recommendations.isPending && (
            <div
              role="status"
              aria-label="Loading suggestions"
              className="grid gap-4 md:grid-cols-2"
            >
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          )}

          {recommendations.data && recommendations.data.length === 0 && (
            <EmptyState
              icon={<ShoppingBasket />}
              title="Nothing matches yet"
              message={
                maxMissing === null
                  ? 'None of our recipes use what you have. Try adding a few staples like eggs, rice or onions.'
                  : 'Try allowing a missing ingredient or two — the list doubles as a shopping hint.'
              }
              action={
                maxMissing !== null ? (
                  <button
                    type="button"
                    onClick={() => setFilter('any')}
                    className="min-h-11 rounded-xl px-4 font-semibold text-brand hover:bg-brand-tint"
                  >
                    Show all suggestions
                  </button>
                ) : (
                  <ButtonLink to="/pantry">Add pantry items</ButtonLink>
                )
              }
            />
          )}

          {recommendations.data && recommendations.data.length > 0 && (
            <>
              {expiringCount > 0 && (
                <p className="mb-4 flex items-center gap-2 text-subhead text-label-secondary">
                  <Hourglass aria-hidden className="size-4 text-warning" />
                  {expiringCount === 1
                    ? '1 suggestion uses something that expires soon.'
                    : `${expiringCount} suggestions use something that expires soon.`}
                </p>
              )}
              <ol className="grid gap-4 md:grid-cols-2" aria-label="Suggested recipes">
                {recommendations.data.map((rec, index) => (
                  <li key={rec.recipe.id}>
                    <RecommendationCard rec={rec} rank={index + 1} />
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </>
  )
}

function RecommendationCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const { recipe } = rec
  const time = formatMinutes(recipe.prep_min, recipe.cook_min)
  const ready = rec.missing.length === 0

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="group flex h-full flex-col rounded-2xl bg-surface p-5 shadow-card transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-headline font-semibold group-hover:text-brand">
          <span className="sr-only">Number {rank}: </span>
          {recipe.title}
        </h2>
        {ready ? (
          <Badge tone="brand" icon={<Sparkles aria-hidden />}>
            Ready
          </Badge>
        ) : (
          <Badge tone="neutral" icon={<ShoppingBasket aria-hidden />}>
            {rec.missing.length} missing
          </Badge>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-label-secondary">
        {time && (
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden className="size-3.5" />
            {time}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users aria-hidden className="size-3.5" />
          Serves {recipe.servings}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-footnote">
          <span className="font-medium text-label">
            You have {rec.have_count} of {rec.required_count}
          </span>
          <span className="text-label-secondary">{Math.round(rec.coverage * 100)}%</span>
        </div>
        <ProgressBar value={rec.coverage} label={`${recipe.title} pantry coverage`} />
      </div>

      <div className="mt-4 space-y-1.5 text-subhead">
        {rec.expiring.length > 0 && (
          <p className="flex items-start gap-1.5 text-warning">
            <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-medium">Uses soon:</span>{' '}
              {rec.expiring.map(titleCase).join(', ')}
            </span>
          </p>
        )}
        {rec.missing.length > 0 && (
          <p className="flex items-start gap-1.5 text-label-secondary">
            <ShoppingBasket aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-medium">Need:</span> {rec.missing.map(titleCase).join(', ')}
            </span>
          </p>
        )}
      </div>

      {recipe.tags.some((t) => t.kind === 'diet') && (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {recipe.tags
            .filter((t) => t.kind === 'diet')
            .map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-fill px-2 py-0.5 text-caption text-label-secondary"
              >
                {tagLabel(t.name)}
              </span>
            ))}
        </div>
      )}
    </Link>
  )
}
