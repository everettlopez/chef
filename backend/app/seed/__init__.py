"""Load the curated prototype data. Safe to re-run: rows are matched by natural keys.

uv run python -m app.seed           # ingredients, dietary tags, recipes
uv run python -m app.seed --demo    # also (re)stock the demo household's pantry
"""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    CookLog,
    DietaryTag,
    Ingredient,
    IngredientAlias,
    PantryItem,
    Recipe,
    RecipeIngredient,
    User,
)
from app.seed.ingredients_data import (
    ANIMAL_NOT_MEAT,
    CONTAINS_GLUTEN,
    CONTAINS_NUTS,
    DIETARY_TAGS,
    INGREDIENTS,
    NOT_VEGETARIAN,
    SHELLFISH,
)
from app.seed.recipes_data import RECIPES
from app.services import households
from app.services.ingredients import Resolver, normalize, parse_line
from app.services.pantry_items import estimate_expiry

# Test-only credentials for the local demo household (not a real account).
DEMO_EMAIL = "demo@chef.test"
DEMO_PASSWORD = "chef-demo-2026"
DEMO_NAME = "Demo Cook"

# (ingredient, quantity, unit, storage, days until expiry; None = use the estimate)
DEMO_PANTRY: list[tuple[str, str | None, str | None, str, int | None]] = [
    ("chicken breast", "1.5", "lb", "fridge", 1),
    ("spinach", "4", "cup", "fridge", 2),
    ("milk", "1", "gallon", "fridge", 3),
    ("egg", "10", None, "fridge", None),
    ("rice", "6", "cup", "pantry", None),
    ("pasta", "16", "oz", "pantry", None),
    ("onion", "3", None, "pantry", None),
    ("garlic", None, None, "pantry", None),
    ("tomato", "3", None, "pantry", 2),
    ("canned tomatoes", "28", "oz", "pantry", None),
    ("black beans", "30", "oz", "pantry", None),
    ("tortillas", "8", None, "fridge", None),
    ("cheddar cheese", "2", "cup", "fridge", None),
    ("parmesan", "1", "cup", "fridge", None),
    ("butter", "16", "tbsp", "fridge", None),
    ("bell pepper", "2", None, "fridge", 4),
    ("lemon", "2", None, "fridge", None),
    ("banana", "3", None, "pantry", 1),
    ("bread", "10", "slice", "pantry", 3),
    ("soy sauce", None, None, "pantry", None),
    ("cumin", None, None, "pantry", None),
]


def seed_ingredients(db: Session) -> None:
    existing = {i.canonical_name: i for i in db.scalars(select(Ingredient))}
    aliases = set(db.scalars(select(IngredientAlias.alias)))
    for name, category, unit, pantry, fridge, freezer, alias_list in INGREDIENTS:
        ingredient = existing.get(name)
        if ingredient is None:
            ingredient = Ingredient(canonical_name=name)
            db.add(ingredient)
        ingredient.category = category
        ingredient.default_unit = unit
        ingredient.shelf_days_pantry = pantry
        ingredient.shelf_days_fridge = fridge
        ingredient.shelf_days_freezer = freezer

        extra = [f"canned {name}"] if category == "canned" and "canned" not in name else []
        for alias in alias_list + extra:
            key = normalize(alias)
            if key and key != name and key not in aliases:
                aliases.add(key)
                ingredient.aliases.append(IngredientAlias(alias=key, source="seed"))
    db.flush()


def seed_tags(db: Session) -> dict[str, DietaryTag]:
    tags = {t.name: t for t in db.scalars(select(DietaryTag))}
    for name, kind in DIETARY_TAGS:
        if name not in tags:
            tags[name] = DietaryTag(name=name, kind=kind)
            db.add(tags[name])
    db.flush()
    return tags


def diet_tags_for(ingredients: list[Ingredient]) -> set[str]:
    """Rule-based tagging from ingredient categories (pipeline 2). Optional lines count too,
    so allergen tags stay conservative."""
    names = {i.canonical_name for i in ingredients}
    categories = {i.category for i in ingredients}
    tags: set[str] = set()
    vegetarian = not categories & {"meat", "seafood"} and not names & NOT_VEGETARIAN
    if vegetarian:
        tags.add("vegetarian")
        if "dairy" not in categories and not names & ANIMAL_NOT_MEAT:
            tags.add("vegan")
    if "dairy" not in categories:
        tags.add("dairy-free")
    if not names & CONTAINS_GLUTEN:
        tags.add("gluten-free")
    if "nuts" in categories or names & CONTAINS_NUTS:
        tags.add("contains-nuts")
    if names & SHELLFISH:
        tags.add("contains-shellfish")
    return tags


def seed_recipes(db: Session, tags: dict[str, DietaryTag]) -> list[str]:
    """Insert or refresh the curated recipes. Returns lines the resolver couldn't match."""
    resolver = Resolver(db)
    unmatched: list[str] = []
    for seed in RECIPES:
        external_id = f"seed:{seed.slug}"
        recipe = db.scalar(select(Recipe).where(Recipe.external_id == external_id))
        if recipe is None:
            recipe = Recipe(external_id=external_id, source="seed")
            db.add(recipe)
        recipe.title = seed.title
        recipe.description = seed.description
        recipe.servings = seed.servings
        recipe.prep_min = seed.prep_min
        recipe.cook_min = seed.cook_min
        recipe.instructions = "\n".join(seed.steps)

        recipe.ingredients.clear()
        db.flush()
        matched: list[Ingredient] = []
        for raw in seed.lines:
            parsed = parse_line(raw)
            match = resolver.resolve(parsed.name)
            if match is None:
                unmatched.append(f"{seed.slug}: {raw}")
            else:
                ingredient = db.get(Ingredient, match.ingredient_id)
                assert ingredient is not None
                matched.append(ingredient)
            recipe.ingredients.append(
                RecipeIngredient(
                    ingredient_id=match.ingredient_id if match else None,
                    quantity=parsed.quantity,
                    unit=parsed.unit,
                    raw_text=raw,
                    optional=parsed.optional,
                    match_confidence=match.confidence if match else None,
                    match_method=match.method if match else None,
                )
            )
        recipe.tags = [tags[name] for name in sorted(diet_tags_for(matched))]
    db.flush()
    return unmatched


def seed_demo(db: Session) -> User:
    """Create the demo account if needed and restock its pantry with fresh dates."""
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user is None:
        user = User(
            email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD), display_name=DEMO_NAME
        )
        db.add(user)
        households.create_household_for(db, user, "Demo Kitchen")
        db.flush()
    assert user.membership is not None
    household_id = user.membership.household_id

    db.execute(delete(CookLog).where(CookLog.household_id == household_id))
    db.execute(delete(PantryItem).where(PantryItem.household_id == household_id))

    by_name = {i.canonical_name: i for i in db.scalars(select(Ingredient))}
    today = date.today()
    for name, quantity, unit, storage, days in DEMO_PANTRY:
        ingredient = by_name[name]
        purchased = today - timedelta(days=2)
        expires = (
            today + timedelta(days=days)
            if days is not None
            else estimate_expiry(ingredient, storage, purchased)
        )
        db.add(
            PantryItem(
                household_id=household_id,
                ingredient=ingredient,
                quantity=Decimal(quantity) if quantity is not None else None,
                unit=unit,
                storage=storage,
                purchased_on=purchased,
                expires_on=expires,
                expiry_estimated=days is None,
                status="active",
                added_by=user.id,
            )
        )
    db.flush()
    return user


def run(db: Session, demo: bool = False) -> list[str]:
    seed_ingredients(db)
    tags = seed_tags(db)
    unmatched = seed_recipes(db, tags)
    if demo:
        seed_demo(db)
    db.commit()
    return unmatched
