from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PantryItemBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    unit: str | None = Field(default=None, max_length=32)


class PantryItemCreate(PantryItemBase):
    quantity: Decimal = Field(default=Decimal("1"), gt=0, max_digits=10, decimal_places=2)


class PantryItemRead(PantryItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Serialized as a JSON number (Decimal would serialize as a string).
    quantity: float
    created_at: datetime
    updated_at: datetime
