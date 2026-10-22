# Chef — your home cooking helper

Chef keeps a virtual pantry shared across a household and suggests recipes from what you
already have, favoring ingredients that expire soon. Instead of finding a recipe and then
checking the pantry, **the pantry finds the recipe**.

CS 4000 Capstone, Fall 2026 · Zach Smilor · Jason Khong · Everett Lopez · Max Donaldson.
The full spec is [Chef Design Document v2.0](Chef%20Design%20Document%20v2.0.pdf).

> **Status: MVP prototype.** It covers every requirement the design doc tiers as MVP (F1–F8)
> and runs locally. Receipt scanning, deployment and the RecipeNLG import come next.

## What works

| ID | Requirement (Design Doc v2.0) | In the MVP |
| -- | ----------------------------- | ---------- |
| F1 | Sign up, log in, log out | Argon2-hashed passwords; signed session in an HttpOnly cookie |
| F2 | Households with invite codes | A household of one at signup; others join with an 8-character code |
| F3 | Add, edit, remove pantry items with autocomplete | Keyboard-friendly autocomplete with fuzzy matching ("brocoli" → broccoli); quantity is optional ("have some") |
| F4 | Estimated, overridable expiry | Estimated from USDA FoodKeeper shelf life for pantry, fridge or freezer; set a date to override it |
| F5 | Browse and search recipes | 40 curated recipes, searchable by name or ingredient, filterable by diet |
| F6 | "What can I make" ranking | Scored `0.7 · coverage + 0.3 · expiring`, with a "missing at most N" filter that doubles as a shopping hint |
| F7 | Diet preferences filter suggestions | Vegetarian, vegan, gluten-free, dairy-free; avoid nuts or shellfish |
| F8 | Logging a meal deducts ingredients, with undo | Uses the oldest-expiring batch first, converts common units, and can be undone exactly |

## Stack

| Layer    | Stack |
| -------- | ----- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7, TanStack Query, lucide icons |
| Backend  | Python 3.13, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, argon2, PyJWT, rapidfuzz |
| Database | MySQL 8.4 (Docker Compose) |

```
frontend/   Vite app. Dev server on :5173 proxies /api to :8000
backend/    FastAPI app on :8000 (OpenAPI docs at /docs); see backend/README.md
pipelines/  Offline data scripts (RecipeNLG import skeleton); see pipelines/README.md
docker/     MySQL init scripts (creates pantry_test for the test suite)
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
uv run alembic upgrade head          # creates the Chef schema
uv run python -m app.seed --demo     # ingredients, recipes, and a stocked demo kitchen
cd ..

cd frontend
npm install
cd ..
```

`python -m app.seed` is safe to re-run. With `--demo` it also restocks the demo household with
fresh dates (some items expiring in 1–3 days), which resets that household's pantry and history.

Optional: copy `backend/.env.example` to `backend/.env` to change the database URLs or set a
real `SECRET_KEY`.

## Run (two terminals)

```powershell
cd backend; uv run uvicorn app.main:app --reload
```

```powershell
cd frontend; npm run dev
```

Open http://localhost:5173.

## Demo walkthrough (for partners)

Sign in with the local demo account: **demo@chef.test** / **chef-demo-2026**
(test data only; it exists just in your local database).

1. **What can I make** — the home page ranks recipes by how much of each the pantry covers.
   Chicken and spinach expire soon, so *Garlic Butter Chicken with Spinach Rice* comes first.
   Try the **Ready now** and **≤1 missing** filters.
2. **Pantry** — items are grouped by *Use soon*, *Fresh* and *No date*. Add one: type
   "brocol", pick *Broccoli*, and Chef picks the fridge and estimates its expiry. Tap any item to
   change the amount, move it to the freezer (the estimate updates), or discard it.
3. **Recipe** — open the top suggestion. Checkmarks show what you have; staples like salt don't
   count against you. Tap **I cooked this**, then look at the pantry: the chicken went from
   1.5 lb to 0.5 lb.
4. **History** — tap **Undo** and the pantry goes back to how it was.
5. **Settings** — turn on *Vegetarian* and *Avoid nuts*; the suggestions change at once.
6. **Household** — copy the invite code, sign out, create a second account, and join with the
   code. Both accounts now share one pantry.

Light and dark mode follow your system setting. The layout works down to phone widths, with a
tab bar at the bottom.

## Design system

The UI follows Apple's Human Interface Guidelines: minimal, spacious, and accessible.
**Phthalo Green `#123524`** is the brand color for actions, links, selection and progress (a
lighter tint, `#3fa37a`, in dark mode).

- **Tokens** live in `frontend/src/index.css` as CSS variables exposed to Tailwind (`bg-brand`,
  `text-label-secondary`, `bg-surface`, ...), with light and dark values. The HIG type scale is
  available as `text-large-title` … `text-caption`.
- **Components** live in `frontend/src/components/ui/`: `Button`, `TextField`, `SearchField`,
  `SegmentedControl`, `Switch`, `List`/`ListRow` (inset grouped), `Badge`, `ProgressBar`,
  `Sheet` (bottom sheet on phones, dialog on desktop), toasts with Undo, and empty, error and
  loading states.
- **Accessibility**: WCAG AA contrast, 44 pt hit targets, visible focus rings, full keyboard
  support (including autocomplete and segmented controls), status shown with icons and text as
  well as color, and reduced motion respected.

New UI should use these tokens and components rather than one-off styles.

## Checks

```powershell
cd backend;  uv run pytest; uv run ruff check .
cd frontend; npm run build; npm run lint
```

The backend tests run against the real MySQL `pantry_test` database, so Docker must be up.

## Database changes

1. Edit or add a model in `backend/app/models/` (and import it in `app/models/__init__.py`).
2. `uv run alembic revision --autogenerate -m "describe change"`, then review the generated file.
3. `uv run alembic upgrade head`.

Reset the database: `docker compose down -v` (deletes the volume), then `docker compose up -d`,
run the migrations, and seed again.

## Adding a feature (pattern)

Backend: model → migration → schema → service → route (registered in `app/main.py`) → test.
Frontend: `src/api/<resource>.ts` (types, fetch functions, query keys) → `src/hooks/`
(useQuery/useMutation) → page built from `components/ui/` → route in `src/router.tsx`.

## Differences from the design doc

These are deliberate choices for the prototype, not open questions:

- **ORM**: SQLAlchemy 2.0 typed models instead of SQLModel. SQLModel is built on SQLAlchemy,
  and this kept the existing code and test setup.
- **Database**: local MySQL in Docker instead of Aiven; nothing is deployed yet.
- **Source control**: GitHub instead of GitLab.
- **Recipe data**: 40 hand-written recipes and 117 ingredients instead of a RecipeNLG subset.
  They still go through the resolver, with 100% of recipe lines matched.
- **Quantities** (open decision in the doc): exact amount and unit, or none for "have some".
  Cooking leaves "have some" items alone, and marks a batch used when units can't be converted.
- **Tables not yet created**: `receipts`, `receipt_lines` and `saved_recipes` (F9, F10).

## Next up

- Receipt scanning spike (F9): choose the OCR approach, build pipeline 3 and the review screen
- Pipeline 2 for real: import a RecipeNLG subset with `pipelines/recipenlg_import.py`, report
  the match rate
- Recommendation evaluation: about 20 pantry scenarios, tracked with precision@5
- Saved recipes (F10) and ratings (F11)
- Deployment: Vercel for the frontend, an API host, Aiven MySQL, CI on each merge request
