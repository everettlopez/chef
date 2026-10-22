import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Hourglass,
  Plus,
  Refrigerator,
  Snowflake,
  Trash2,
  Warehouse,
} from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { errorMessage } from '../api/client'
import type { Ingredient, PantryItem, Storage } from '../api/pantry'
import { IngredientCombobox } from '../components/IngredientCombobox'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorBanner, ListSkeleton, PageHeader } from '../components/ui/Feedback'
import { List, ListRow } from '../components/ui/List'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Sheet } from '../components/ui/Sheet'
import { TextField } from '../components/ui/TextField'
import { useToast } from '../components/ui/toastContext'
import {
  useCreatePantryItem,
  useDiscardPantryItem,
  usePantryItems,
  useUpdatePantryItem,
} from '../hooks/usePantry'
import {
  addDays,
  defaultStorage,
  expiryLabel,
  expiryTone,
  formatQuantity,
  formatShortDate,
  shelfDays,
  titleCase,
  todayISO,
  type ExpiryTone,
} from '../lib/format'

const storageOptions: { value: Storage; label: string }[] = [
  { value: 'pantry', label: 'Pantry' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
]

const storageIcons: Record<Storage, ReactNode> = {
  pantry: <Warehouse aria-hidden className="size-[1.125rem]" />,
  fridge: <Refrigerator aria-hidden className="size-[1.125rem]" />,
  freezer: <Snowflake aria-hidden className="size-[1.125rem]" />,
}

const groups: { tone: ExpiryTone; title: string; footer?: string }[] = [
  { tone: 'expired', title: 'Expired', footer: 'Check these before using, or discard them.' },
  { tone: 'soon', title: 'Use soon', footer: 'Chef favors recipes that use these.' },
  { tone: 'fresh', title: 'Fresh' },
  { tone: 'none', title: 'No date' },
]

const badgeFor: Record<ExpiryTone, { tone: BadgeTone; icon: ReactNode }> = {
  expired: { tone: 'danger', icon: <AlertTriangle aria-hidden /> },
  soon: { tone: 'warning', icon: <Hourglass aria-hidden /> },
  fresh: { tone: 'brand', icon: <CheckCircle2 aria-hidden /> },
  none: { tone: 'neutral', icon: <CalendarClock aria-hidden /> },
}

export function PantryPage() {
  const { data: items, isPending, isError } = usePantryItems()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PantryItem | null>(null)

  const grouped = useMemo(() => {
    const byTone = new Map<ExpiryTone, PantryItem[]>()
    for (const item of items ?? []) {
      const tone = expiryTone(item.expires_on)
      byTone.set(tone, [...(byTone.get(tone) ?? []), item])
    }
    return byTone
  }, [items])

  return (
    <>
      <PageHeader
        title="Pantry"
        subtitle={
          items && items.length > 0
            ? `${items.length} item${items.length === 1 ? '' : 's'} shared with your household`
            : 'Everything your household has on hand.'
        }
        actions={
          <Button icon={<Plus aria-hidden />} onClick={() => setAdding(true)}>
            Add item
          </Button>
        }
      />

      {isPending && <ListSkeleton rows={5} />}
      {isError && (
        <ErrorBanner>Couldn't load your pantry. Check that the API is running.</ErrorBanner>
      )}
      {items && items.length === 0 && (
        <EmptyState
          icon={<Refrigerator />}
          title="Nothing here yet"
          message="Add what's in your fridge and cupboards. Chef estimates when each item expires."
          action={
            <Button icon={<Plus aria-hidden />} onClick={() => setAdding(true)}>
              Add your first item
            </Button>
          }
        />
      )}

      <div className="space-y-8">
        {groups.map(({ tone, title, footer }) => {
          const group = grouped.get(tone)
          if (!group?.length) return null
          const badge = badgeFor[tone]
          return (
            <List key={tone} header={`${title} · ${group.length}`} footer={footer}>
              {group.map((item) => {
                const expiry = (
                  <Badge tone={badge.tone} icon={badge.icon}>
                    {expiryLabel(item.expires_on)}
                    {item.expires_on && item.expiry_estimated && (
                      <span className="font-normal opacity-75"> · est.</span>
                    )}
                  </Badge>
                )
                return (
                  <ListRow
                    key={item.id}
                    onClick={() => setEditing(item)}
                    leading={
                      <span className="flex size-9 items-center justify-center rounded-full bg-fill text-label-secondary">
                        {storageIcons[item.storage]}
                      </span>
                    }
                    title={titleCase(item.ingredient.canonical_name)}
                    subtitle={
                      <>
                        {formatQuantity(item.quantity, item.unit)}
                        <span aria-hidden> · </span>
                        <span className="capitalize">{item.storage}</span>
                        {/* On phones the badge sits under the name so the name isn't cut off. */}
                        <span className="mt-1.5 flex sm:hidden">{expiry}</span>
                      </>
                    }
                    trailing={<span className="hidden sm:flex">{expiry}</span>}
                  />
                )
              })}
            </List>
          )
        })}
      </div>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add to pantry"
        description="Chef estimates expiry from USDA FoodKeeper shelf-life data."
      >
        <AddItemForm onDone={() => setAdding(false)} />
      </Sheet>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? titleCase(editing.ingredient.canonical_name) : ''}
        description={editing ? `Added ${formatShortDate(editing.purchased_on)}` : undefined}
      >
        {editing && <EditItemForm item={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  )
}

function QuantityFields({
  quantity,
  unit,
  onQuantity,
  onUnit,
}: {
  quantity: string
  unit: string
  onQuantity: (v: string) => void
  onUnit: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField
        label="Quantity"
        type="number"
        inputMode="decimal"
        min="0.01"
        step="any"
        placeholder="Have some"
        value={quantity}
        onChange={(e) => onQuantity(e.target.value)}
      />
      <TextField
        label="Unit"
        placeholder="e.g. cup, lb"
        value={unit}
        onChange={(e) => onUnit(e.target.value)}
        maxLength={32}
        autoCapitalize="none"
      />
    </div>
  )
}

function AddItemForm({ onDone }: { onDone: () => void }) {
  const create = useCreatePantryItem()
  const toast = useToast()
  const [text, setText] = useState('')
  const [ingredient, setIngredient] = useState<Ingredient | null>(null)
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [storage, setStorage] = useState<Storage>('pantry')
  const [expiresOn, setExpiresOn] = useState('')

  const estimate = useMemo(() => {
    if (!ingredient) return null
    const days = shelfDays(ingredient, storage)
    return days === null ? null : addDays(todayISO(), days)
  }, [ingredient, storage])

  function select(choice: Ingredient) {
    setIngredient(choice)
    setText(titleCase(choice.canonical_name))
    setStorage(defaultStorage(choice))
    if (!unit && choice.default_unit) setUnit(choice.default_unit)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate(
      {
        ...(ingredient ? { ingredient_id: ingredient.id } : { name: text.trim() }),
        quantity: quantity ? Number(quantity) : null,
        unit: quantity && unit.trim() ? unit.trim() : null,
        storage,
        expires_on: expiresOn || null,
      },
      {
        onSuccess: (item) => {
          toast({ message: `Added ${titleCase(item.ingredient.canonical_name)} to your pantry.` })
          onDone()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {create.isError && <ErrorBanner>{errorMessage(create.error)}</ErrorBanner>}
      <IngredientCombobox
        value={text}
        onChange={(value) => {
          setText(value)
          setIngredient(null)
        }}
        onSelect={select}
        autoFocus
      />
      <QuantityFields quantity={quantity} unit={unit} onQuantity={setQuantity} onUnit={setUnit} />
      <div>
        <p className="mb-1.5 text-footnote font-medium text-label-secondary">Stored in</p>
        <SegmentedControl
          label="Stored in"
          options={storageOptions}
          value={storage}
          onChange={setStorage}
        />
      </div>
      <TextField
        label="Expires on"
        type="date"
        min={todayISO()}
        value={expiresOn}
        onChange={(e) => setExpiresOn(e.target.value)}
        hint={
          expiresOn
            ? 'Your date overrides the estimate.'
            : estimate
              ? `Leave blank to use the estimate: ${formatShortDate(estimate)}.`
              : 'Leave blank to let Chef estimate.'
        }
      />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!text.trim() || create.isPending}
      >
        {create.isPending ? 'Adding…' : 'Add to pantry'}
      </Button>
    </form>
  )
}

function EditItemForm({ item, onDone }: { item: PantryItem; onDone: () => void }) {
  const update = useUpdatePantryItem()
  const discard = useDiscardPantryItem()
  const toast = useToast()
  const [quantity, setQuantity] = useState(item.quantity === null ? '' : String(item.quantity))
  const [unit, setUnit] = useState(item.unit ?? '')
  const [storage, setStorage] = useState<Storage>(item.storage)
  const [expiresOn, setExpiresOn] = useState(item.expiry_estimated ? '' : (item.expires_on ?? ''))
  const name = titleCase(item.ingredient.canonical_name)
  const busy = update.isPending || discard.isPending

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    update.mutate(
      {
        id: item.id,
        data: {
          quantity: quantity ? Number(quantity) : null,
          unit: unit.trim() || null,
          storage,
          ...(expiresOn ? { expires_on: expiresOn } : { use_estimate: true }),
        },
      },
      { onSuccess: onDone },
    )
  }

  function markUsed() {
    update.mutate(
      { id: item.id, data: { status: 'used' } },
      {
        onSuccess: () => {
          toast({
            message: `Marked ${name} as used up.`,
            actionLabel: 'Undo',
            onAction: () => update.mutate({ id: item.id, data: { status: 'active' } }),
          })
          onDone()
        },
      },
    )
  }

  function remove() {
    discard.mutate(item.id, {
      onSuccess: () => {
        toast({
          message: `Discarded ${name}.`,
          actionLabel: 'Undo',
          onAction: () => update.mutate({ id: item.id, data: { status: 'active' } }),
        })
        onDone()
      },
    })
  }

  const estimate = shelfDays(item.ingredient, storage)

  return (
    <form onSubmit={save} className="space-y-5">
      {(update.isError || discard.isError) && (
        <ErrorBanner>{errorMessage(update.error ?? discard.error)}</ErrorBanner>
      )}
      <QuantityFields quantity={quantity} unit={unit} onQuantity={setQuantity} onUnit={setUnit} />
      <div>
        <p className="mb-1.5 text-footnote font-medium text-label-secondary">Stored in</p>
        <SegmentedControl
          label="Stored in"
          options={storageOptions}
          value={storage}
          onChange={setStorage}
        />
      </div>
      <TextField
        label="Expires on"
        type="date"
        value={expiresOn}
        onChange={(e) => setExpiresOn(e.target.value)}
        hint={
          expiresOn
            ? 'Clear the date to go back to the estimate.'
            : estimate !== null
              ? `Estimated: ${formatShortDate(addDays(item.purchased_on, estimate))}.`
              : 'No shelf-life data for this item.'
        }
      />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {update.isPending ? 'Saving…' : 'Save changes'}
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="gray"
          icon={<CheckCircle2 aria-hidden />}
          onClick={markUsed}
          disabled={busy}
        >
          Used up
        </Button>
        <Button
          variant="destructive"
          icon={<Trash2 aria-hidden />}
          onClick={remove}
          disabled={busy}
        >
          Discard
        </Button>
      </div>
    </form>
  )
}
