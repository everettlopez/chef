# Data pipelines

Offline scripts that load and clean data for Chef (Design Doc v2.0, *Data pipelines and
normalization*). They run on demand against a dev database, never on the web server, and
share one ingredient resolver with the API: `backend/app/services/ingredients.py`
(exact alias → singular form → rapidfuzz fuzzy match, each stored with `match_confidence`
and `match_method`).

| # | Pipeline | Status |
| - | -------- | ------ |
| 1 | Ingredient canonicalization (RecipeNLG `NER` field → `ingredients`, `ingredient_aliases`) | Seeded by hand for the MVP (`backend/app/seed/ingredients_data.py`) |
| 2 | Recipe ingestion (RecipeNLG subset → `recipes`, `recipe_ingredients`, `recipe_tags`) | Skeleton: `recipenlg_import.py`; MVP uses 40 curated recipes |
| 3 | Receipt normalization (OCR text → `receipt_lines` → `pantry_items`) | Not started (F9, after the OCR spike) |
| 4 | Expiration estimation (USDA FoodKeeper → `shelf_days_*`) | Hand-entered FoodKeeper values in the seed |

## Running

From `backend/` (so the app package and its venv are available):

```powershell
uv run python ../pipelines/recipenlg_import.py path\to\RecipeNLG_dataset.csv --limit 20000 --dry-run
```

`--dry-run` only reports the line match rate (the pipeline 2 evaluation metric) without
writing. Drop it to import. Download RecipeNLG yourself from its official source; it is
licensed for non-commercial research and education use.
