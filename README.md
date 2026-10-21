# Virtual Pantry

Full-stack skeleton: **React → FastAPI → MySQL → React**.

| Layer    | Stack                                                    |
| -------- | -------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router 7, TanStack Query |
| Backend  | Python 3.13, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic |
| Database | MySQL 8.4 (Docker Compose)                                |

```
frontend/  Vite app — dev server on :5173, proxies /api → :8000
backend/   FastAPI app — :8000, OpenAPI docs at /docs
docker/    MySQL init scripts (creates pantry_test for the test suite)
```

MySQL is exposed on host port **3307** (not 3306) so it can coexist with a locally installed MySQL.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 22 LTS](https://nodejs.org/)
- [uv](https://docs.astral.sh/uv/): `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`
  (uv downloads Python 3.13 for the backend automatically)

## First-time setup

```powershell
Copy-Item .env.example .env
docker compose up -d                 # wait until `docker compose ps` shows "healthy"

cd backend
uv sync
uv run alembic upgrade head          # creates the pantry_items table
cd ..

cd frontend
npm install
cd ..
```

## Run (two terminals)

```powershell
cd backend; uv run uvicorn app.main:app --reload
```

```powershell
cd frontend; npm run dev
```

Open http://localhost:5173. The home page shows API and database status. The Pantry page lists items and adds new ones. They're stored in MySQL, so they're still there after a reload.

## Checks

```powershell
cd backend;  uv run pytest; uv run ruff check .
cd frontend; npm run build; npm run lint
```

## Database changes

1. Edit or add a model in `backend/app/models/` (and import it in `app/models/__init__.py`).
2. `uv run alembic revision --autogenerate -m "describe change"`, then review the generated file.
3. `uv run alembic upgrade head`.

Reset the database: `docker compose down -v` (deletes the volume), then `docker compose up -d` and run migrations again.

## Adding a feature (pattern)

Backend: model → schema → service → route (registered in `app/main.py`) → test.
Frontend: `src/api/<resource>.ts` (types + fetch fns + query keys) → `src/hooks/` (useQuery/useMutation) → page/component → route in `src/router.tsx`.
