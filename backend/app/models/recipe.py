from decimal import Decimal

from sqlalchemy import Column, ForeignKey, Numeric, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.ingredient import Ingredient

recipe_tags = Table(
    "recipe_tags",
    Base.metadata,
    Column("recipe_id", ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("dietary_tags.id", ondelete="CASCADE"), primary_key=True),
)


class DietaryTag(Base):
    __tablename__ = "dietary_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(40), unique=True)
    # "diet" (vegetarian, vegan, ...) or "allergen" (contains-nuts, ...).
    kind: Mapped[str] = mapped_column(String(16))


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    instructions: Mapped[str] = mapped_column(Text)
    prep_min: Mapped[int | None]
    cook_min: Mapped[int | None]
    servings: Mapped[int] = mapped_column(default=2)
    source: Mapped[str] = mapped_column(String(32), default="seed")
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)

    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan", order_by="RecipeIngredient.id"
    )
    tags: Mapped[list[DietaryTag]] = relationship(secondary=recipe_tags, order_by=DietaryTag.name)


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"))
    # NULL until the line is matched to a canonical ingredient.
    ingredient_id: Mapped[int | None] = mapped_column(ForeignKey("ingredients.id"), index=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    unit: Mapped[str | None] = mapped_column(String(32))
    raw_text: Mapped[str] = mapped_column(String(255))
    optional: Mapped[bool] = mapped_column(default=False)
    match_confidence: Mapped[float | None]
    match_method: Mapped[str | None] = mapped_column(String(16))

    recipe: Mapped[Recipe] = relationship(back_populates="ingredients")
    ingredient: Mapped[Ingredient | None] = relationship(lazy="joined")
