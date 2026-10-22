# Import every model here so Base.metadata sees it (Alembic autogenerate, tests).
from app.models.cook_log import CookLog, PantryUsage
from app.models.diet import UserDietPref
from app.models.household import Household, HouseholdMember, User
from app.models.ingredient import Ingredient, IngredientAlias
from app.models.pantry_item import PantryItem
from app.models.recipe import DietaryTag, Recipe, RecipeIngredient, recipe_tags

__all__ = [
    "CookLog",
    "DietaryTag",
    "Household",
    "HouseholdMember",
    "Ingredient",
    "IngredientAlias",
    "PantryItem",
    "PantryUsage",
    "Recipe",
    "RecipeIngredient",
    "User",
    "UserDietPref",
    "recipe_tags",
]
