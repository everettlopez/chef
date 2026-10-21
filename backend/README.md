# Virtual Pantry API

FastAPI + SQLAlchemy 2.0 + MySQL. See the root README for setup.

```
app/
  api/routes/   HTTP layer (request/response, status codes)
  services/     query and business logic
  models/       SQLAlchemy ORM tables
  schemas/      Pydantic request/response models
  db/           engine, session, declarative base
  core/         settings
alembic/        migrations
tests/          pytest suite (runs against the pantry_test database)
```
