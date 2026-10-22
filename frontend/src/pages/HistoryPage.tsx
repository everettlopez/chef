import { CookingPot, RotateCcw } from 'lucide-react'
import { Button, ButtonLink } from '../components/ui/Button'
import { EmptyState, ErrorBanner, ListSkeleton, PageHeader } from '../components/ui/Feedback'
import { List, ListRow } from '../components/ui/List'
import { useToast } from '../components/ui/toastContext'
import { useCookLogs, useUndoCookLog } from '../hooks/useCookLogs'
import { describeUsage, formatDateTime } from '../lib/format'

export function HistoryPage() {
  const { data: logs, isPending, isError } = useCookLogs()
  const undo = useUndoCookLog()
  const toast = useToast()

  return (
    <>
      <PageHeader
        title="History"
        subtitle="Meals your household has cooked. Undo puts the ingredients back."
      />

      {isPending && <ListSkeleton />}
      {isError && <ErrorBanner>Couldn't load your history.</ErrorBanner>}
      {logs && logs.length === 0 && (
        <EmptyState
          icon={<CookingPot />}
          title="No meals logged yet"
          message='Open a recipe and tap "I cooked this" — Chef updates your pantry for you.'
          action={<ButtonLink to="/">Find something to cook</ButtonLink>}
        />
      )}
      {logs && logs.length > 0 && (
        <List>
          {logs.map((log) => (
            <ListRow
              key={log.id}
              leading={
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-tint text-brand">
                  <CookingPot aria-hidden className="size-[1.125rem]" />
                </span>
              }
              title={log.recipe_title}
              subtitle={
                <>
                  <span className="block">
                    {formatDateTime(log.cooked_at)} · {log.servings_made} serving
                    {log.servings_made === 1 ? '' : 's'}
                    {log.cooked_by ? ` · ${log.cooked_by}` : ''}
                  </span>
                  {log.usages.length > 0 && (
                    <span className="mt-0.5 block text-footnote text-label-tertiary">
                      Used {log.usages.map(describeUsage).join(', ')}
                    </span>
                  )}
                </>
              }
              trailing={
                <Button
                  variant="tinted"
                  size="sm"
                  icon={<RotateCcw aria-hidden />}
                  aria-label={`Undo ${log.recipe_title}`}
                  disabled={undo.isPending && undo.variables === log.id}
                  onClick={() =>
                    undo.mutate(log.id, {
                      onSuccess: () =>
                        toast({ message: `Undid ${log.recipe_title}. Pantry restored.` }),
                    })
                  }
                >
                  Undo
                </Button>
              }
            />
          ))}
        </List>
      )}
    </>
  )
}
