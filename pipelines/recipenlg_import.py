"""Pipeline 2 skeleton: import a RecipeNLG subset through the shared ingredient resolver.

Run from backend/:  uv run python ../pipelines/recipenlg_import.py DATASET.csv [--limit N]

RecipeNLG columns used: title, ingredients (JSON list of raw lines), directions (JSON list),
link (stable id). Not used for the MVP demo; kept so the team can measure match rate early.
"""

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import select  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models import Recipe, RecipeIngredient  # noqa: E402
from app.seed import diet_tags_for, seed_tags  # noqa: E402
from app.services.ingredients import Resolver, parse_line  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--limit", type=int, default=20_000)
    parser.add_argument("--dry-run", action="store_true", help="report match rate only")
    args = parser.parse_args()

    csv.field_size_limit(10_000_000)
    total = matched = imported = 0
    with SessionLocal() as db, args.csv_path.open(encoding="utf-8", newline="") as f:
        resolver = Resolver(db)
        tags = seed_tags(db)
        for i, row in enumerate(csv.DictReader(f)):
            if i >= args.limit:
                break
            external_id = f"recipenlg:{row['link']}"[:64]
            lines: list[str] = json.loads(row["ingredients"])
            parsed = [(raw, parse_line(raw)) for raw in lines]
            matches = [resolver.resolve(p.name) for _, p in parsed]
            total += len(matches)
            matched += sum(m is not None for m in matches)

            if args.dry_run or db.scalar(
                select(Recipe.id).where(Recipe.external_id == external_id)
            ):
                continue
            recipe = Recipe(
                title=row["title"][:200],
                instructions="\n".join(json.loads(row["directions"])),
                servings=4,  # RecipeNLG has no serving counts
                source="recipenlg",
                external_id=external_id,
            )
            for (raw, p), m in zip(parsed, matches, strict=True):
                recipe.ingredients.append(
                    RecipeIngredient(
                        ingredient_id=m.ingredient_id if m else None,
                        quantity=p.quantity,
                        unit=p.unit,
                        raw_text=raw[:255],
                        optional=p.optional,
                        match_confidence=m.confidence if m else None,
                        match_method=m.method if m else None,
                    )
                )
            db.add(recipe)
            db.flush()
            recipe.tags = [
                tags[name]
                for name in diet_tags_for(
                    [ri.ingredient for ri in recipe.ingredients if ri.ingredient]
                )
            ]
            imported += 1
            if imported % 500 == 0:
                db.commit()
        db.commit()

    rate = matched / total if total else 0
    print(f"Lines: {total}  matched: {matched}  match rate: {rate:.1%}  imported: {imported}")


if __name__ == "__main__":
    main()
