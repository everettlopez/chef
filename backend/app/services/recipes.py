"""Recipe browsing and the "What can I make" recommender.

The score is transparent rather than learned (Design Doc v2.0, Recommendation approach):

    score = W_COVERAGE * have / required + W_URGENCY * expiring / required

where `required` counts a recipe's non-optional, non-staple ingredients, `have` those in the
household's active pantry, and `expiring` those whose soonest batch expires within
URGENT_DAYS. Recipes that break the user's diet preferences are filtered out first.
"""

from datetime import date, timedelta

from sqlalchemy import Select, case, distinct, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Household,
    Ingredient,
    PantryItem,
    Recipe,
    RecipeIngredient,
    User,
    UserDietPref,
    recipe_tags,
)
from app.schemas.recipe import (
    RecipeDetail,
    RecipeIngredientRead,
    RecipeSummary,
    Recommendation,
)
from app.services.errors import NotFoundError

W_COVERAGE = 0.7
W_URGENCY = 0.3
URGENT_DAYS = 3
STAPLE = "staple"


def pantry_expiry_by_ingredient(db: Session, household: Household) -> dict[int, date | None]:
    """Active pantry ingredients mapped to their soonest expiration date."""
    rows = db.execute(
        select(PantryItem.ingredient_id, func.min(PantryItem.expires_on))
        .where(PantryItem.household_id == household.id, PantryItem.status == "active")
        .group_by(PantryItem.ingredient_id)
    )
    return {ingredient_id: soonest for ingredient_id, soonest in rows}


def list_recipes(
    db: Session, q: str | None, tag_id: int | None, limit: int, offset: int
) -> list[Recipe]:
    stmt = select(Recipe).options(selectinload(Recipe.tags)).order_by(Recipe.title)
    if q:
        pattern = f"%{q.strip()}%"
        by_ingredient = (
            select(RecipeIngredient.recipe_id)
            .join(Ingredient)
            .where(Ingredient.canonical_name.like(pattern))
        )
        stmt = stmt.where(or_(Recipe.title.like(pattern), Recipe.id.in_(by_ingredient)))
    if tag_id is not None:
        stmt = stmt.where(
            Recipe.id.in_(select(recipe_tags.c.recipe_id).where(recipe_tags.c.tag_id == tag_id))
        )
    return list(db.scalars(stmt.limit(limit).offset(offset)))


def get_recipe(db: Session, household: Household, recipe_id: int) -> RecipeDetail:
    recipe = db.get(Recipe, recipe_id, options=[selectinload(Recipe.tags)])
    if recipe is None:
        raise NotFoundError("Recipe not found")
    have = pantry_expiry_by_ingredient(db, household)
    return RecipeDetail(
        **RecipeSummary.model_validate(recipe).model_dump(),
        instructions=recipe.instructions,
        ingredients=[
            RecipeIngredientRead(
                id=line.id,
                raw_text=line.raw_text,
                quantity=float(line.quantity) if line.quantity is not None else None,
                unit=line.unit,
                optional=line.optional,
                ingredient_id=line.ingredient_id,
                ingredient_name=line.ingredient.canonical_name if line.ingredient else None,
                staple=line.ingredient is not None and line.ingredient.category == STAPLE,
                in_pantry=line.ingredient_id in have,
            )
            for line in recipe.ingredients
        ],
    )


def _apply_diet_filter(stmt: Select, db: Session, user: User) -> Select:
    prefs = list(db.scalars(select(UserDietPref).where(UserDietPref.user_id == user.id)))
    required = [p.tag_id for p in prefs if p.mode == "require"]
    avoided = [p.tag_id for p in prefs if p.mode == "avoid"]
    recipe_id = RecipeIngredient.recipe_id

    if required:
        stmt = stmt.where(
            recipe_id.in_(
                select(recipe_tags.c.recipe_id)
                .where(recipe_tags.c.tag_id.in_(required))
                .group_by(recipe_tags.c.recipe_id)
                .having(func.count(distinct(recipe_tags.c.tag_id)) == len(required))
            )
        )
    if avoided:
        stmt = stmt.where(
            recipe_id.not_in(
                select(recipe_tags.c.recipe_id).where(recipe_tags.c.tag_id.in_(avoided))
            )
        )
    return stmt


def recommend(
    db: Session, household: Household, user: User, max_missing: int | None, limit: int
) -> list[Recommendation]:
    urgent_by = date.today() + timedelta(days=URGENT_DAYS)
    have = (
        select(
            PantryItem.ingredient_id.label("ingredient_id"),
            func.min(PantryItem.expires_on).label("soonest"),
        )
        .where(PantryItem.household_id == household.id, PantryItem.status == "active")
        .group_by(PantryItem.ingredient_id)
        .subquery()
    )

    required = func.count(distinct(RecipeIngredient.ingredient_id))
    have_count = func.count(distinct(have.c.ingredient_id))
    expiring_count = func.count(distinct(case((have.c.soonest <= urgent_by, have.c.ingredient_id))))
    score = (W_COVERAGE * have_count + W_URGENCY * expiring_count) / required

    stmt = (
        select(
            RecipeIngredient.recipe_id,
            required.label("required"),
            have_count.label("have"),
            score.label("score"),
        )
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .outerjoin(have, have.c.ingredient_id == RecipeIngredient.ingredient_id)
        .where(RecipeIngredient.optional.is_(False), Ingredient.category != STAPLE)
        .group_by(RecipeIngredient.recipe_id)
        .having(have_count > 0)
        .order_by(score.desc(), have_count.desc(), RecipeIngredient.recipe_id)
        .limit(limit)
    )
    if max_missing is not None:
        stmt = stmt.having(required - have_count <= max_missing)
    stmt = _apply_diet_filter(stmt, db, user)

    rows = db.execute(stmt).all()
    if not rows:
        return []

    ids = [row.recipe_id for row in rows]
    recipes = {
        r.id: r
        for r in db.scalars(
            select(Recipe)
            .where(Recipe.id.in_(ids))
            .options(selectinload(Recipe.tags), selectinload(Recipe.ingredients))
        )
    }
    pantry = pantry_expiry_by_ingredient(db, household)

    results = []
    for row in rows:
        recipe = recipes[row.recipe_id]
        missing: list[str] = []
        expiring: list[str] = []
        for line in recipe.ingredients:
            ingredient = line.ingredient
            if line.optional or ingredient is None or ingredient.category == STAPLE:
                continue
            name = ingredient.canonical_name
            if ingredient.id not in pantry:
                target = missing
            elif (soonest := pantry[ingredient.id]) is not None and soonest <= urgent_by:
                target = expiring
            else:
                continue
            if name not in target:
                target.append(name)
        results.append(
            Recommendation(
                recipe=RecipeSummary.model_validate(recipe),
                score=round(float(row.score), 4),
                coverage=round(row.have / row.required, 4),
                have_count=row.have,
                required_count=row.required,
                missing=missing,
                expiring=expiring,
            )
        )
    return results
