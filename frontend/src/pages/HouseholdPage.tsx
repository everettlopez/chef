import { Copy, Crown, RefreshCw, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../api/client'
import { Button } from '../components/ui/Button'
import { ErrorBanner, ListSkeleton, PageHeader } from '../components/ui/Feedback'
import { List, ListRow } from '../components/ui/List'
import { Sheet } from '../components/ui/Sheet'
import { TextField } from '../components/ui/TextField'
import { useToast } from '../components/ui/toastContext'
import { useMe } from '../hooks/useAuth'
import {
  useHousehold,
  useJoinHousehold,
  useRegenerateInviteCode,
  useRenameHousehold,
} from '../hooks/useHousehold'

export function HouseholdPage() {
  const { data: household, isPending, isError } = useHousehold()
  const { data: me } = useMe()
  const regenerate = useRegenerateInviteCode()
  const toast = useToast()
  const [renaming, setRenaming] = useState(false)
  const [joining, setJoining] = useState(false)

  async function copyCode() {
    if (!household) return
    try {
      await navigator.clipboard.writeText(household.invite_code)
      toast({ message: 'Invite code copied.' })
    } catch {
      toast({ message: `Invite code: ${household.invite_code}` })
    }
  }

  return (
    <>
      <PageHeader
        title={household?.name ?? 'Household'}
        subtitle="Everyone here shares one pantry, one history and the same suggestions."
        actions={
          household && (
            <Button variant="tinted" onClick={() => setRenaming(true)}>
              Rename
            </Button>
          )
        }
      />

      {isPending && <ListSkeleton rows={3} />}
      {isError && <ErrorBanner>Couldn't load your household.</ErrorBanner>}

      {household && (
        <div className="space-y-8">
          <section
            aria-labelledby="invite-heading"
            className="rounded-2xl bg-surface p-5 shadow-card sm:p-6"
          >
            <h2 id="invite-heading" className="text-headline font-semibold">
              Invite roommates
            </h2>
            <p className="mt-1 text-subhead text-label-secondary">
              Share this code. When someone joins, they see your pantry right away.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <code
                aria-label={`Invite code ${household.invite_code.split('').join(' ')}`}
                className="rounded-xl bg-fill px-4 py-2.5 font-mono text-title2 font-semibold tracking-[0.2em] text-brand"
              >
                {household.invite_code}
              </code>
              <Button icon={<Copy aria-hidden />} onClick={copyCode}>
                Copy
              </Button>
              <Button
                variant="plain"
                icon={<RefreshCw aria-hidden />}
                onClick={() => regenerate.mutate()}
                disabled={regenerate.isPending}
              >
                New code
              </Button>
            </div>
          </section>

          <List
            header={`Members · ${household.members.length}`}
            footer="Need to switch kitchens? Join another household with its code."
          >
            {household.members.map((member) => (
              <ListRow
                key={member.user_id}
                leading={
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-full bg-brand text-subhead font-semibold text-on-brand"
                  >
                    {member.display_name.slice(0, 1).toUpperCase()}
                  </span>
                }
                title={
                  <>
                    {member.display_name}
                    {member.user_id === me?.id && (
                      <span className="text-label-secondary"> (you)</span>
                    )}
                  </>
                }
                subtitle={member.email}
                trailing={
                  member.role === 'owner' && (
                    <span className="inline-flex items-center gap-1 text-footnote">
                      <Crown aria-hidden className="size-3.5" />
                      Owner
                    </span>
                  )
                }
              />
            ))}
          </List>

          <Button variant="tinted" icon={<UserPlus aria-hidden />} onClick={() => setJoining(true)}>
            Join another household
          </Button>
        </div>
      )}

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Rename household">
        {household && <RenameForm current={household.name} onDone={() => setRenaming(false)} />}
      </Sheet>
      <Sheet
        open={joining}
        onClose={() => setJoining(false)}
        title="Join a household"
        description="You'll leave your current household. If you're its only member, its pantry is deleted."
      >
        <JoinForm onDone={() => setJoining(false)} />
      </Sheet>
    </>
  )
}

function RenameForm({ current, onDone }: { current: string; onDone: () => void }) {
  const rename = useRenameHousehold()
  const [name, setName] = useState(current)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    rename.mutate(name.trim(), { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {rename.isError && <ErrorBanner>{errorMessage(rename.error)}</ErrorBanner>}
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        required
        data-autofocus
      />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!name.trim() || rename.isPending}
      >
        Save
      </Button>
    </form>
  )
}

function JoinForm({ onDone }: { onDone: () => void }) {
  const join = useJoinHousehold()
  const toast = useToast()
  const [code, setCode] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    join.mutate(code.trim(), {
      onSuccess: (household) => {
        toast({ message: `Welcome to ${household.name}!` })
        onDone()
      },
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {join.isError && <ErrorBanner>{errorMessage(join.error)}</ErrorBanner>}
      <TextField
        label="Invite code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="8 characters"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={16}
        className="[&_input]:font-mono [&_input]:tracking-[0.2em]"
        required
        data-autofocus
      />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={code.trim().length < 4 || join.isPending}
      >
        {join.isPending ? 'Joining…' : 'Join household'}
      </Button>
    </form>
  )
}
