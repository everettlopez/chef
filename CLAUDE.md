# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Virtual Pantry: React 19 + TypeScript (Vite) frontend → FastAPI (Python 3.13, SQLAlchemy 2.0, Pydantic v2, Alembic) backend → MySQL 8.4 in Docker Compose. Only MySQL runs in Docker; the backend and frontend run on the host. Windows dev environment (PowerShell).

## Commands

Prereqs: Docker Desktop, Node 22, `uv` (manages Python 3.13 and the backend venv).

```powershell
# Database (repo root; copy .env.example to .env first)
docker compose up -d          # wait for `docker compose ps` to show "healthy"
docker compose down -v        # full reset: deletes the mysql_data volume; re-run migrations after

# Backend (from backend/)
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload            # :8000, Swagger at /docs
uv run pytest                                   # all tests
uv run pytest tests/test_pantry_items.py::test_name   # single test
uv run ruff check .                             # lint (line-length 100; rules E,F,I,UP,B)
uv run alembic revision --autogenerate -m "msg" # then review the generated file

# Frontend (from frontend/)
npm install
npm run dev                   # :5173
npm run build                 # tsc -b && vite build (this is the type check)
npm run lint
```

`.claude/launch.json` defines `backend` and `frontend` dev-server configs for the preview tools.

## Architecture

**Request path:** the browser hits Vite on :5173. Vite proxies `/api/*` to FastAPI on :8000 (`frontend/vite.config.ts`), so dev has a single origin. `apiFetch` in `frontend/src/api/client.ts` prefixes `VITE_API_BASE_URL` (default `/api`) and throws `ApiError(status, detail)` on non-2xx responses. All FastAPI routers are mounted under the `/api` prefix in `backend/app/main.py`.

**MySQL is on host port 3307**, not 3306, so it doesn't clash with a local MySQL install. Root `.env` feeds docker compose. `backend/.env` (optional) overrides `app/core/config.py` settings (`DATABASE_URL`, `TEST_DATABASE_URL`, `CORS_ORIGINS`). `docker/mysql/init/` runs only when the volume is empty; it creates the `pantry_test` database.

**Backend layering** (`backend/app/`): `api/routes/` (HTTP only) → `services/` (queries and business logic; services call `db.commit()`) → `models/` (SQLAlchemy ORM). Pydantic request/response models live in `schemas/`. Routes get a session through the `DbSession` annotated dependency (`api/deps.py` wraps `db/session.get_db`).
- New models must be imported in `app/models/__init__.py`. Both Alembic's `env.py` and the test `conftest.py` rely on that import to register tables on `Base.metadata`.
- New routers must be registered in `app/main.py` with `prefix="/api"`.
- Money and quantity fields are `Numeric`/`Decimal` in the model and in the create schema, but the read schema uses `float` so the JSON contains numbers instead of strings.

**Tests** (`backend/tests/conftest.py`) run against the real MySQL `pantry_test` database, so Docker must be up. A session-scoped engine runs `drop_all`/`create_all` from metadata (not Alembic). Each test runs inside a connection-level transaction with `join_transaction_mode="create_savepoint"`, so app-code commits only release a savepoint and everything is rolled back afterward. The `client` fixture overrides `get_db` with that session.

**Frontend data flow** (`frontend/src/`): React Router 7 (`router.tsx`, `createBrowserRouter`) handles page routing. `AppLayout` is the parent route. TanStack Query handles server state; the `QueryClient` in `main.tsx` uses `staleTime: 30s` and `retry: 1`. Per resource:
1. `api/<resource>.ts`: TS types that mirror the backend Pydantic schemas (keep them in sync by hand), fetch functions, and a query-key object.
2. `hooks/use<Resource>.ts`: `useQuery`/`useMutation` wrappers. Mutations invalidate the resource's query keys on success.
3. A page in `pages/`, registered in `router.tsx`.

**Adding a feature:** backend model → migration → schema → service → route (register in `main.py`) → test. Then on the frontend: `api/` → `hooks/` → page → route.
