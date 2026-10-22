import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { DietPref, Tag } from '../api/recipes'
import { Button } from '../components/ui/Button'
import { ErrorBanner, ListSkeleton, PageHeader } from '../components/ui/Feedback'
import { List, ListRow } from '../components/ui/List'
import { Switch } from '../components/ui/Switch'
import { useLogout, useMe } from '../hooks/useAuth'
import { useDietaryTags, useDietPrefs, useSetDietPrefs } from '../hooks/useRecipes'
import { tagLabel } from '../lib/format'

const dietCopy: Record<string, string> = {
  vegetarian: 'No meat or fish',
  vegan: 'No animal products',
  'gluten-free': 'No wheat, pasta or bread',
  'dairy-free': 'No milk, butter or cheese',
  'contains-nuts': 'Hide recipes with nuts or peanuts',
  'contains-shellfish': 'Hide recipes with shellfish',
}

export function SettingsPage() {
  const { data: me } = useMe()
  const tags = useDietaryTags()
  const prefs = useDietPrefs()
  const setPrefs = useSetDietPrefs()
  const logout = useLogout()
  const navigate = useNavigate()

  // Diet tags are "require" (only show), allergen tags are "avoid" (hide).
  const modeFor = (tag: Tag): DietPref['mode'] => (tag.kind === 'allergen' ? 'avoid' : 'require')
  const enabled = new Set(prefs.data?.map((p) => p.tag.id))

  function toggle(tag: Tag, on: boolean) {
    const next = (prefs.data ?? [])
      .filter((p) => p.tag.id !== tag.id)
      .map((p) => ({ tag_id: p.tag.id, mode: p.mode }))
    if (on) next.push({ tag_id: tag.id, mode: modeFor(tag) })
    setPrefs.mutate(next)
  }

  function signOut() {
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
  }

  const diet = tags.data?.filter((t) => t.kind === 'diet') ?? []
  const allergens = tags.data?.filter((t) => t.kind === 'allergen') ?? []

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-8">
        {me && (
          <List header="Account">
            <ListRow title="Name" trailing={me.display_name} />
            <ListRow title="Email" trailing={<span className="truncate">{me.email}</span>} />
          </List>
        )}

        {setPrefs.isError && <ErrorBanner>Couldn't save your preferences. Try again.</ErrorBanner>}
        {(tags.isPending || prefs.isPending) && <ListSkeleton rows={4} />}
        {tags.data && prefs.data && (
          <>
            <List
              header="Diet"
              footer="Suggestions only include recipes that match every diet you turn on."
            >
              {diet.map((tag) => (
                <PrefRow key={tag.id} tag={tag} checked={enabled.has(tag.id)} onChange={toggle} />
              ))}
            </List>
            <List
              header="Allergies"
              footer="Recipes are tagged from their ingredients, including optional ones."
            >
              {allergens.map((tag) => (
                <PrefRow key={tag.id} tag={tag} checked={enabled.has(tag.id)} onChange={toggle} />
              ))}
            </List>
          </>
        )}

        <Button
          variant="destructive"
          size="lg"
          icon={<LogOut aria-hidden />}
          className="w-full sm:w-auto"
          onClick={signOut}
        >
          Sign out
        </Button>
      </div>
    </>
  )
}

function PrefRow({
  tag,
  checked,
  onChange,
}: {
  tag: Tag
  checked: boolean
  onChange: (tag: Tag, on: boolean) => void
}) {
  const title =
    tag.kind === 'allergen'
      ? `Avoid ${tagLabel(tag.name).replace('Contains ', '').toLowerCase()}`
      : tagLabel(tag.name)
  return (
    <ListRow
      title={title}
      subtitle={dietCopy[tag.name]}
      trailing={<Switch label={title} checked={checked} onChange={(on) => onChange(tag, on)} />}
    />
  )
}
