import { execSync } from 'node:child_process'
import { E2E_DATABASE_URL } from '../playwright.config'

/** Bring the pantry_e2e database to the latest schema and load the curated recipes. */
export default function globalSetup() {
  const options = {
    cwd: '../backend',
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'inherit' as const,
  }
  execSync('uv run alembic upgrade head', options)
  execSync('uv run python -m app.seed', options)
}
