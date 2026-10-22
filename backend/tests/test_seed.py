from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models import (
    DietaryTag,
    Ingredient,
    IngredientAlias,
    PantryItem,
    Recipe,
    RecipeIngredient,
    User,
)
from app.seed import DEMO_EMAIL, DEMO_PANTRY, DEMO_PASSWORD, diet_tags_for, run
from app.seed.recipes_data import RECIPES


def counts(db: Session) -> dict[str, int]:
    models = (Ingredient, IngredientAlias, DietaryTag, Recipe, RecipeIngredient)
    return {m.__name__: db.scalar(select(func.count()).select_from(m)) or 0 for m in models}


def test_seed_is_idempotent(db_session: Session) -> None:
    before = counts(db_session)

    unmatched = run(db_session)

    assert unmatched == []
    assert counts(db_session) == before
    assert before["Recipe"] == len(RECIPES) == 40
    assert before["DietaryTag"] == 6


def test_every_seeded_line_resolves(db_session: Session) -> None:
    unmatched = db_session.scalar(
        select(func.count(RecipeIngredient.id)).where(RecipeIngredient.ingredient_id.is_(None))
    )
    methods = set(db_session.scalars(select(RecipeIngredient.match_method).distinct()))

    assert unmatched == 0
    assert methods <= {"exact", "fuzzy"}


def test_every_recipe_has_ingredients_and_steps(db_session: Session) -> None:
    for recipe in db_session.scalars(select(Recipe)):
        assert recipe.ingredients, recipe.title
        assert recipe.instructions.strip(), recipe.title
        assert recipe.servings >= 1, recipe.title


def test_demo_household_is_created_once_and_restocked(db_session: Session) -> None:
    run(db_session, demo=True)
    run(db_session, demo=True)

    demo = db_session.scalars(select(User).where(User.email == DEMO_EMAIL)).one()
    assert verify_password(demo.password_hash, DEMO_PASSWORD)
    assert demo.membership is not None
    stocked = db_session.scalar(
        select(func.count(PantryItem.id)).where(
            PantryItem.household_id == demo.membership.household_id
        )
    )
    assert stocked == len(DEMO_PANTRY)


def test_diet_tagging_rules(db_session: Session) -> None:
    by_name = {i.canonical_name: i for i in db_session.scalars(select(Ingredient))}

    def tags(*names: str) -> set[str]:
        return diet_tags_for([by_name[n] for n in names])

    assert tags("rice", "garlic") >= {"vegan", "vegetarian", "dairy-free", "gluten-free"}
    assert "vegan" not in tags("rice", "butter")
    assert "vegetarian" in tags("rice", "butter")
    assert not tags("chicken breast") & {"vegan", "vegetarian"}
    assert "gluten-free" not in tags("pasta")
    assert "contains-nuts" in tags("peanut butter")
