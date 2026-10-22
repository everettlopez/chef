import re
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Storage = Literal["pantry", "fridge", "freezer"]
Status = Literal["active", "used", "discarded"]


class IngredientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    canonical_name: str
    category: str
    default_unit: str | None
    shelf_days_pantry: int | None
    shelf_days_fridge: int | None
    shelf_days_freezer: int | None


class PantryItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # Either a known ingredient id (from autocomplete) or free text to resolve.
    ingredient_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    # Omit for "have some".
    quantity: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    unit: str | None = Field(default=None, max_length=32)
    storage: Storage = "pantry"
    purchased_on: date | None = None
    # Set to override the estimate.
    expires_on: date | None = None

    @field_validator("name")
    @classmethod
    def _name_has_text(cls, name: str | None) -> str | None:
        # Punctuation-only text would normalize to an empty ingredient name.
        if name is not None and not re.search(r"[A-Za-z0-9]", name):
            raise ValueError("Ingredient name needs at least one letter or number")
        return name

    @model_validator(mode="after")
    def _needs_ingredient(self) -> "PantryItemCreate":
        if self.ingredient_id is None and not self.name:
            raise ValueError("Provide ingredient_id or name")
        return self


class PantryItemUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    quantity: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    unit: str | None = Field(default=None, max_length=32)
    storage: Storage | None = None
    purchased_on: date | None = None
    expires_on: date | None = None
    # True drops a manual override and goes back to the estimate.
    use_estimate: bool = False
    status: Status | None = None


class PantryItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ingredient: IngredientRead
    # Serialized as a JSON number (Decimal would serialize as a string).
    quantity: float | None
    unit: str | None
    storage: str
    purchased_on: date
    expires_on: date | None
    expiry_estimated: bool
    status: str
