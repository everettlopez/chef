# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chef (capstone project; spec in `Chef Design Document v2.0.pdf`): a household-shared virtual pantry that ranks recipes by pantry coverage and expiry urgency. React 19 + TypeScript (Vite, Tailwind CSS v4) frontend → FastAPI (Python 3.13, SQLAlchemy 2.0, Pydantic v2, Alembic) backend → MySQL 8.4 in Docker Compose. Only MySQL runs in Docker; the backend and frontend run on the host. Windows dev environment (PowerShell).

## Commands

Prereqs: Docker Desktop, Node 22, `uv` (manages Python 3.13 and the backend venv).

```powershell
# Database (repo root; copy .env.example to .env first)
docker compose up -d          # wait for `docker compose ps` to show "healthy"
docker compose down -v        # full reset: deletes the mysql_data volume; re-run migrations and seed after

# Backend (from backend/)
uv sync
uv run alembic upgrade head
uv run python -m app.seed --demo                # curated data + demo household (idempotent)
uv run uvicorn app.main:app --reload            # :8000, Swagger at /docs
uv run pytest                                   # all tests
uv run pytest tests/test_pantry_items.py::test_name   # single test
uv run pytest --cov                             # with coverage
uv run ruff check .                             # lint (line-length 100; rules E,F,I,UP,B)
uv run ruff format .                            # formatter
uv run alembic revision --autogenerate -m "msg" # then review the generated file

# Frontend (from frontend/)
npm install
npm run dev                   # :5173
npm run build                 # tsc -b && vite build (this is the type check)
npm run lint
npm test                      # Vitest unit/component/page tests (jsdom + MSW)
npm run test:coverage
npm run test:e2e              # Playwright; starts its own servers on :8001/:5174 (run `npx playwright install chromium` once)
npx prettier --no-semi --single-quote --print-width 100 --trailing-comma all --write src e2e   # house style (no config file)
```

`.claude/launch.json` defines `backend` and `frontend` dev-server configs for the preview tools. The local demo login is in `backend/app/seed/__init__.py` (`DEMO_EMAIL` / `DEMO_PASSWORD`).

## Architecture

**Request path:** the browser hits Vite on :5173. Vite proxies `/api/*` to FastAPI on :8000 (`frontend/vite.config.ts`; `CHEF_API_URL` overrides the target), so dev has a single origin. `apiFetch` in `frontend/src/api/client.ts` prefixes `VITE_API_BASE_URL` (default `/api`), sends the session cookie (`credentials: 'same-origin'`) and throws `ApiError(status, detail)` on non-2xx responses; `errorMessage()` turns that into display text. All FastAPI routers are mounted under the `/api` prefix in `backend/app/main.py`.

**MySQL is on host port 3307**, not 3306, so it doesn't clash with a local MySQL install. Root `.env` feeds docker compose. `backend/.env` (optional; see `backend/.env.example`) overrides `app/core/config.py` settings (`DATABASE_URL`, `TEST_DATABASE_URL`, `CORS_ORIGINS`, `SECRET_KEY`, `SESSION_COOKIE_SECURE`). `docker/mysql/init/` runs only when the volume is empty; it creates the `pantry_test`, `pantry_migrate` and `pantry_e2e` databases.

**Backend layering** (`backend/app/`): `api/routes/` (HTTP only) → `services/` (queries and business logic; services call `db.commit()`) → `models/` (SQLAlchemy ORM). Pydantic request/response models live in `schemas/`. Routes get dependencies from `api/deps.py`: `DbSession`, `CurrentUser` (reads the `chef_session` JWT cookie, 401 otherwise) and `CurrentHousehold`.
- Services raise `NotFoundError` / `ConflictError` / `AuthError` from `services/errors.py`; `main.py` maps them to 404 / 409 / 401. Don't raise `HTTPException` from services.
- Everything household-owned (pantry items, cook logs) must be filtered by the current household; another household's id returns 404.
- New models must be imported in `app/models/__init__.py`. Both Alembic's `env.py` and the test `conftest.py` rely on that import to register tables on `Base.metadata`.
- New routers must be registered in `app/main.py` (the `for module in (...)` loop adds `prefix="/api"`).
- Money and quantity fields are `Numeric`/`Decimal` in the model and in the create schema, but the read schema uses `float` so the JSON contains numbers instead of strings.
- `services/ingredients.py` is the shared ingredient resolver (parse line → exact alias → singular → rapidfuzz). The seed, the API and `pipelines/` all use it; change matching there, not per caller.
- The recommender (`services/recipes.py`) ignores ingredients with category `staple` and optional lines. Its weights and `URGENT_DAYS` are mirrored by `URGENT_DAYS` in `frontend/src/lib/format.ts`.

**Tests** (`backend/tests/conftest.py`) run against the real MySQL `pantry_test` database, so Docker must be up. A session-scoped engine runs `drop_all`/`create_all` from metadata (not Alembic) and loads the curated seed once. Each test runs inside a connection-level transaction with `join_transaction_mode="create_savepoint"`, so app-code commits only release a savepoint and everything is rolled back afterward. Fixtures: `client` (anonymous), `sign_up(email, name)` (a signed-in `TestClient` per user, each with its own cookie jar), `auth_client` (one signed-in user). `join_household(joiner, owner)` moves a user into another's household. `test_migrations.py` runs Alembic up/down on the separate `pantry_migrate` database and checks the models match the migrations (`compare_metadata`), so a model change without a migration fails.

**Frontend tests** (`frontend/src/**/*.test.ts[x]`, Vitest + Testing Library): `src/test/server.ts` is an MSW fake of the whole API, backed by the in-memory `db` in `src/test/db.ts` (typed with the `src/api` types, reset before each test; `requestsTo(method, path)` shows what the app sent). `renderApp(route)` in `src/test/render.tsx` renders the real routes, providers and `createQueryClient()` (from `src/queryClient.ts`) in a memory router; `renderWithProviders(ui)` does one component. Query by role and accessible name. `src/test/setup.ts` polyfills `<dialog>` and works around React Router's AbortSignal under jsdom. Use `fireEvent`, not user-event, with fake timers.

**E2E tests** (`frontend/e2e/`, Playwright, desktop and 375 px projects): `global-setup.ts` migrates and seeds `pantry_e2e`; `helpers.ts` has `signUp` (a unique user per test, so specs run in parallel), `stock` (adds pantry items through the API with the page's cookie) and `inviteCode`.

CI (`.github/workflows/ci.yml`) runs backend, frontend and then E2E jobs on pushes to `main` and on PRs.

**Frontend data flow** (`frontend/src/`): React Router 7 (`router.tsx`, `createBrowserRouter`) handles page routing. `/login` and `/signup` are public; `RequireAuth` (in `components/AppLayout.tsx`) guards the rest using `useMe()` and renders the app shell. TanStack Query handles server state; the `QueryClient` in `main.tsx` uses `staleTime: 30s` and doesn't retry 4xx errors. Per resource:
1. `api/<resource>.ts`: TS types that mirror the backend Pydantic schemas (keep them in sync by hand), fetch functions, and a query-key object.
2. `hooks/use<Resource>.ts`: `useQuery`/`useMutation` wrappers. Mutations invalidate every key their change affects (pantry changes also invalidate `recipeKeys.all`, since coverage depends on the pantry).
3. A page in `pages/`, registered in `router.tsx`.

**Design system (required for all UI work):** Apple Human Interface Guidelines, with Phthalo Green `#123524` as the brand color (`#3fa37a` in dark mode). Use the semantic tokens from `src/index.css` (`bg-brand`, `text-on-brand`, `bg-surface`, `bg-canvas`, `bg-fill`, `text-label[-secondary|-tertiary]`, `divide-separator`, `text-danger`, `text-warning`) and the HIG type scale (`text-large-title`, `text-title1-3`, `text-headline`, `text-body`, `text-callout`, `text-subhead`, `text-footnote`, `text-caption`). Never hard-code colors in components. Build from `components/ui/` (`Button`/`ButtonLink`/`IconButton`, `TextField`, `SearchField`, `SegmentedControl`, `Switch`, `List`/`ListRow`, `Badge`, `ProgressBar`, `Sheet`, `useToast`, and `Feedback.tsx` for `PageHeader`/`EmptyState`/`ErrorBanner`/skeletons). Keep hit targets ≥ 44 px (`min-h-11`), pair status colors with an icon and text, give icon-only controls an accessible name, and check light mode, dark mode and 375 px width. Fields inside a `Sheet` use `data-autofocus` (not `autoFocus`), because `showModal()` moves focus.

**Adding a feature:** backend model → migration → schema → service → route (register in `main.py`) → test. Then on the frontend: `api/` → `hooks/` → page → route.
