from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    canonical_name: Mapped[str] = mapped_column(String(120), unique=True)
    # "staple" ingredients (salt, water, ...) are ignored when scoring recipes.
    category: Mapped[str] = mapped_column(String(32))
    default_unit: Mapped[str | None] = mapped_column(String(32))
    shelf_days_pantry: Mapped[int | None]
    shelf_days_fridge: Mapped[int | None]
    shelf_days_freezer: Mapped[int | None]

    aliases: Mapped[list["IngredientAlias"]] = relationship(
        back_populates="ingredient", cascade="all, delete-orphan"
    )


class IngredientAlias(Base):
    __tablename__ = "ingredient_aliases"

    id: Mapped[int] = mapped_column(primary_key=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id", ondelete="CASCADE"))
    alias: Mapped[str] = mapped_column(String(120), unique=True)
    source: Mapped[str] = mapped_column(String(32), default="seed")

    ingredient: Mapped[Ingredient] = relationship(back_populates="aliases")
