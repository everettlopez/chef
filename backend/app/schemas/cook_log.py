from datetime import datetime

from pydantic import BaseModel, Field


class CookLogCreate(BaseModel):
    recipe_id: int
    # Defaults to the recipe's own serving count.
    servings_made: int | None = Field(default=None, ge=1, le=50)


class UsageRead(BaseModel):
    pantry_item_id: int
    ingredient_name: str
    # None when the whole batch was used up without a tracked amount.
    quantity_used: float | None
    unit: str | None


class CookLogRead(BaseModel):
    id: int
    recipe_id: int
    recipe_title: str
    servings_made: int
    cooked_by: str | None
    cooked_at: datetime
    usages: list[UsageRead]
