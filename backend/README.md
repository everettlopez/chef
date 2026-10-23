# Chef API

FastAPI + SQLAlchemy 2.0 + MySQL. See the root README for setup.

```
app/
  api/routes/   HTTP layer (request/response, status codes); one router per resource
  api/deps.py   DbSession, CurrentUser and CurrentHousehold dependencies
  services/     queries and business logic; raise services/errors.py on failure
  models/       SQLAlchemy ORM tables (Design Doc v2.0 data model)
  schemas/      Pydantic request/response models
  seed/         curated ingredients, dietary tags and recipes (python -m app.seed)
  db/           engine, session, declarative base
  core/         settings, password hashing and session tokens
alembic/        migrations
tests/          pytest suite (pantry_test database; test_migrations.py uses pantry_migrate)
```

## Endpoints

All under `/api`; everything except `health` and `auth/signup|login` needs a session cookie.

| Area | Endpoints |
| ---- | --------- |
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Household | `GET/PATCH /household`, `POST /household/invite-code`, `POST /household/join` |
| Ingredients | `GET /ingredients?q=` (autocomplete) |
| Pantry | `GET/POST /pantry`, `PATCH/DELETE /pantry/{id}` (delete = discard) |
| Recipes | `GET /recipes?q=&tag_id=`, `GET /recipes/{id}`, `GET /recipes/recommendations?max_missing=` |
| Diet | `GET /dietary-tags`, `GET/PUT /me/diet-prefs` |
| Cook logs | `GET/POST /cook-logs`, `DELETE /cook-logs/{id}` (undo) |

## Key pieces

- **Ingredient resolver** (`services/ingredients.py`): `parse_line` splits "1 (14 oz) can
  diced tomatoes" into quantity, unit and name; `Resolver.resolve` tries the exact alias, the
  singular form, then rapidfuzz `token_sort_ratio` ≥ 85. Shared by the API, the seed and
  `pipelines/`.
- **Recommender** (`services/recipes.py`): one aggregate query scores
  `0.7 · coverage + 0.3 · expiring/required` over non-optional, non-staple ingredients, after
  filtering by the user's diet preferences. Weights and the 3-day window are module constants.
- **Cook logs** (`services/cook_logs.py`): deduct from the oldest-expiring batch first, with
  unit conversion within volume and mass. `pantry_usages` records each draw so undo is exact.
