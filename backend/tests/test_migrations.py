"""Alembic round trip on a scratch database (pantry_migrate), separate from pantry_test."""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.exc import OperationalError

from alembic import command
from app.core.config import get_settings
from app.db.base import Base

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def migrate_engine() -> Iterator[Engine]:
    engine = create_engine(get_settings().migrate_database_url, pool_pre_ping=True)
    try:
        engine.connect().close()
    except OperationalError:
        message = "pantry_migrate database not available (see README > Testing)"
        if os.environ.get("CI"):
            pytest.fail(message)
        pytest.skip(message)
    yield engine
    engine.dispose()


@pytest.fixture
def alembic_config(migrate_engine: Engine, monkeypatch: pytest.MonkeyPatch) -> Iterator[Config]:
    # env.py reads DATABASE_URL from settings, so point the settings at the scratch database.
    settings = get_settings()
    monkeypatch.setattr(settings, "database_url", settings.migrate_database_url)
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    command.downgrade(config, "base")
    yield config
    command.downgrade(config, "base")


def tables(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names()) - {"alembic_version"}


def test_upgrade_downgrade_round_trip(alembic_config: Config, migrate_engine: Engine) -> None:
    command.upgrade(alembic_config, "head")
    assert tables(migrate_engine) == set(Base.metadata.tables)

    command.downgrade(alembic_config, "base")
    assert tables(migrate_engine) == set()

    command.upgrade(alembic_config, "head")
    assert tables(migrate_engine) == set(Base.metadata.tables)


def test_migrations_match_the_models(alembic_config: Config, migrate_engine: Engine) -> None:
    command.upgrade(alembic_config, "head")

    with migrate_engine.connect() as connection:
        diffs = compare_metadata(MigrationContext.configure(connection), Base.metadata)
        version = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()

    assert diffs == [], "models changed without a migration: run alembic revision --autogenerate"
    assert version is not None
