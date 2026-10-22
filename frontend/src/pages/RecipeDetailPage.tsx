import {
  Check,
  ChevronLeft,
  Circle,
  Clock,
  CookingPot,
  Minus,
  Plus,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { errorMessage } from '../api/client'
import type { RecipeDetail } from '../api/recipes'
import { Badge } from '../components/ui/Badge'
import { Button, IconButton } from '../components/ui/Button'
import { EmptyState, ErrorBanner, Skeleton } from '../components/ui/Feedback'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Sheet } from '../components/ui/Sheet'
import { useToast } from '../components/ui/toastContext'
import { useLogCook, useUndoCookLog } from '../hooks/useCookLogs'
import { useRecipe } from '../hooks/useRecipes'
import { cn } from '../lib/cn'
import { describeUsage, formatMinutes, tagLabel } from '../lib/format'

export function RecipeDetailPage() {
  const recipeId = Number(useParams().recipeId)
  const { data: recipe, isPending, isError } = useRecipe(recipeId)
  const [cooking, setCooking] = useState(false)

  const back = (
    <Link
      to="/recipes"
      className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-0.5 rounded-xl pr-3 pl-1 text-body text-brand hover:bg-brand-tint"
    >
      <ChevronLeft aria-hidden className="size-5" />
      Recipes
    </Link>
  )

  if (isPending) {
    return (
      <div role="status" aria-label="Loading recipe">
        {back}
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="mt-3 h-5 w-1/2" />
        <Skeleton className="mt-8 h-64 rounded-2xl" />
      </div>
    )
  }
  if (isError || !recipe) {
    return (
      <>
        {back}
        <EmptyState
          icon={<CookingPot />}
          title="Recipe not found"
          message="It may have been removed."
        />
      </>
    )
  }

  const required = recipe.ingredients.filter((i) => !i.optional && !i.staple && i.ingredient_id)
  const have = required.filter((i) => i.in_pantry).length
  const coverage = required.length ? have / required.length : 0
  const time = formatMinutes(recipe.prep_min, recipe.cook_min)
  const steps = recipe.instructions.split('\n').filter(Boolean)

  return (
    <article>
      {back}
      <header className="mb-8">
        <h1 className="text-large-title font-bold">{recipe.title}</h1>
        {recipe.description && (
          <p className="mt-2 max-w-2xl text-callout text-label-secondary">{recipe.description}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {time && <Badge icon={<Clock aria-hidden />}>{time}</Badge>}
          <Badge icon={<Users aria-hidden />}>Serves {recipe.servings}</Badge>
          {recipe.tags.map((tag) => (
            <Badge
              key={tag.id}
              tone={tag.kind === 'allergen' ? 'warning' : 'brand'}
              icon={tag.kind === 'allergen' ? <ShieldAlert aria-hidden /> : undefined}
            >
              {tagLabel(tag.name)}
            </Badge>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <section
          aria-labelledby="ingredients-heading"
          className="rounded-2xl bg-surface p-5 shadow-card lg:sticky lg:top-20"
        >
          <h2 id="ingredients-heading" className="text-title3 font-semibold">
            Ingredients
          </h2>
          <div className="mt-3 mb-4">
            <div className="mb-1.5 flex justify-between text-footnote">
              <span className="font-medium">
                You have {have} of {required.length}
              </span>
              <span className="text-label-secondary">{Math.round(coverage * 100)}%</span>
            </div>
            <ProgressBar value={coverage} label="Pantry coverage" />
          </div>
          <IngredientList recipe={recipe} />
          <Button
            size="lg"
            icon={<CookingPot aria-hidden />}
            className="mt-5 w-full"
            onClick={() => setCooking(true)}
          >
            I cooked this
          </Button>
          <p className="mt-2 text-center text-footnote text-label-secondary">
            Deducts what you used from the pantry, oldest first.
          </p>
        </section>

        <section
          aria-labelledby="steps-heading"
          className="rounded-2xl bg-surface p-5 shadow-card sm:p-6"
        >
          <h2 id="steps-heading" className="text-title3 font-semibold">
            Instructions
          </h2>
          <ol className="mt-4 space-y-5">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-tint text-footnote font-semibold text-brand"
                >
                  {index + 1}
                </span>
                <p className="pt-0.5 text-body">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Sheet
        open={cooking}
        onClose={() => setCooking(false)}
        title="Log this meal"
        description={recipe.title}
      >
        <CookForm recipe={recipe} onDone={() => setCooking(false)} />
      </Sheet>
    </article>
  )
}

function IngredientList({ recipe }: { recipe: RecipeDetail }) {
  return (
    <ul className="divide-y divide-separator">
      {recipe.ingredients.map((line) => {
        const status = line.staple ? 'staple' : line.in_pantry ? 'have' : 'missing'
        return (
          <li key={line.id} className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
              {status === 'have' ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-brand text-on-brand">
                  <Check aria-hidden className="size-3.5" strokeWidth={3} />
                </span>
              ) : (
                <Circle
                  aria-hidden
                  className={cn(
                    'size-5',
                    status === 'staple' ? 'text-fill-strong' : 'text-label-tertiary',
                  )}
                />
              )}
            </span>
            <span className="min-w-0 flex-1 text-subhead">
              <span className="text-label">{line.raw_text}</span>
              <span className="sr-only">
                {status === 'have'
                  ? ' (in your pantry)'
                  : status === 'missing'
                    ? ' (missing)'
                    : ' (staple)'}
              </span>
              {(line.optional || line.staple) && (
                <span className="ml-1.5 text-footnote text-label-tertiary">
                  {line.staple ? 'staple' : 'optional'}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function CookForm({ recipe, onDone }: { recipe: RecipeDetail; onDone: () => void }) {
  const [servings, setServings] = useState(recipe.servings)
  const logCook = useLogCook()
  const undo = useUndoCookLog()
  const toast = useToast()

  function submit() {
    logCook.mutate(
      { recipe_id: recipe.id, servings_made: servings },
      {
        onSuccess: (log) => {
          const used = log.usages.map(describeUsage)
          toast({
            message: used.length
              ? `Logged! Used ${used.slice(0, 3).join(', ')}${used.length > 3 ? ` and ${used.length - 3} more` : ''}.`
              : 'Logged! Nothing to deduct from the pantry.',
            actionLabel: 'Undo',
            onAction: () => undo.mutate(log.id),
          })
          onDone()
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      {logCook.isError && <ErrorBanner>{errorMessage(logCook.error)}</ErrorBanner>}
      <div className="flex items-center justify-between rounded-2xl bg-fill px-4 py-2">
        <span id="servings-label" className="text-body">
          Servings made
        </span>
        <div className="flex items-center gap-1" role="group" aria-labelledby="servings-label">
          <IconButton
            label="Fewer servings"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
            disabled={servings <= 1}
          >
            <Minus aria-hidden className="size-5" />
          </IconButton>
          <output
            aria-live="polite"
            className="w-8 text-center text-title3 font-semibold tabular-nums"
          >
            {servings}
          </output>
          <IconButton label="More servings" onClick={() => setServings((s) => Math.min(50, s + 1))}>
            <Plus aria-hidden className="size-5" />
          </IconButton>
        </div>
      </div>
      <p className="text-subhead text-label-secondary">
        Chef will deduct ingredients for {servings} serving{servings === 1 ? '' : 's'} from your
        pantry, starting with whatever expires first. You can undo this from History.
      </p>
      <Button size="lg" className="w-full" onClick={submit} disabled={logCook.isPending}>
        {logCook.isPending ? 'Logging…' : 'Log meal & update pantry'}
      </Button>
    </div>
  )
}
