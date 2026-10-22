import contextlib
import importlib.util
import sys
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Recipe

PIPELINE = Path(__file__).resolve().parents[2] / "pipelines" / "recipenlg_import.py"
SAMPLE = Path(__file__).parent / "fixtures" / "recipenlg_sample.csv"


@pytest.fixture
def run_import(db_session: Session, monkeypatch: pytest.MonkeyPatch, capsys):
    spec = importlib.util.spec_from_file_location("recipenlg_import", PIPELINE)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # Point the script at the test transaction instead of the dev database.
    monkeypatch.setattr(module, "SessionLocal", lambda: contextlib.nullcontext(db_session))

    def run(*args: str) -> str:
        monkeypatch.setattr(sys, "argv", ["recipenlg_import.py", str(SAMPLE), *args])
        module.main()
        return capsys.readouterr().out

    return run


def recipe_count(db: Session) -> int:
    return db.scalar(select(func.count(Recipe.id))) or 0


def test_dry_run_reports_match_rate_without_writing(run_import, db_session: Session) -> None:
    before = recipe_count(db_session)

    out = run_import("--dry-run", "--limit", "2")

    assert "Lines: 5  matched: 4  match rate: 80.0%  imported: 0" in out
    assert recipe_count(db_session) == before


def test_import_writes_recipes_once(run_import, db_session: Session) -> None:
    before = recipe_count(db_session)

    first = run_import("--limit", "2")
    second = run_import("--limit", "2")

    assert "imported: 2" in first
    assert "imported: 0" in second  # matched by external_id
    assert recipe_count(db_session) == before + 2
    stew = db_session.scalars(select(Recipe).where(Recipe.title == "Test Mystery Stew")).one()
    assert stew.source == "recipenlg"
    assert [line.ingredient_id is None for line in stew.ingredients] == [False, True]
    rice = db_session.scalars(select(Recipe).where(Recipe.title == "Test Garlic Rice")).one()
    assert "vegetarian" in {t.name for t in rice.tags}
