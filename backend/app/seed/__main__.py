import argparse

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models import Ingredient, Recipe, RecipeIngredient
from app.seed import DEMO_EMAIL, run

parser = argparse.ArgumentParser(description="Load Chef's curated prototype data.")
parser.add_argument("--demo", action="store_true", help="also restock the demo household")
args = parser.parse_args()

with SessionLocal() as db:
    unmatched = run(db, demo=args.demo)
    lines = db.scalar(select(func.count(RecipeIngredient.id))) or 0
    fuzzy = db.scalar(
        select(func.count(RecipeIngredient.id)).where(RecipeIngredient.match_method == "fuzzy")
    )
    print(
        f"Ingredients: {db.scalar(select(func.count(Ingredient.id)))}  "
        f"Recipes: {db.scalar(select(func.count(Recipe.id)))}  "
        f"Recipe lines: {lines} (fuzzy: {fuzzy}, unmatched: {len(unmatched)}, "
        f"match rate: {(lines - len(unmatched)) / lines:.1%})"
        if lines
        else "No recipe lines loaded."
    )
    for line in unmatched:
        print(f"  unmatched -> {line}")
    if args.demo:
        print(
            f"Demo household restocked. Sign in as {DEMO_EMAIL} (password in app/seed/__init__.py)."
        )
