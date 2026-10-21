import { useHealth } from '../hooks/useHealth'

export function HomePage() {
  const { data, isPending, isError } = useHealth()

  return (
    <section>
      <h1>Welcome</h1>
      <p>Track what's in your pantry.</p>

      <h2>System status</h2>
      {isPending && <p>Checking…</p>}
      {isError && <p className="status status-error">API or database unreachable</p>}
      {data && (
        <p className="status status-ok">
          API {data.status} · Database {data.database}
        </p>
      )}
    </section>
  )
}
