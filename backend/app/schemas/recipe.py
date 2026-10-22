from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    kind: str


class RecipeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    prep_min: int | None
    cook_min: int | None
    servings: int
    tags: list[TagRead]


class RecipeIngredientRead(BaseModel):
    id: int
    raw_text: str
    quantity: float | None
    unit: str | None
    optional: bool
    ingredient_id: int | None
    ingredient_name: str | None
    # Staples (salt, water, ...) don't count toward coverage.
    staple: bool
    in_pantry: bool


class RecipeDetail(RecipeSummary):
    instructions: str
    ingredients: list[RecipeIngredientRead]


class Recommendation(BaseModel):
    recipe: RecipeSummary
    score: float
    coverage: float
    have_count: int
    required_count: int
    missing: list[str]
    expiring: list[str]


class DietPref(BaseModel):
    tag_id: int
    mode: Literal["require", "avoid"]


class DietPrefRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tag: TagRead
    mode: str


class DietPrefsUpdate(BaseModel):
    prefs: list[DietPref] = Field(max_length=50)
