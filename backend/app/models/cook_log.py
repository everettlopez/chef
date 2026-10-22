from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.household import User
from app.models.pantry_item import PantryItem
from app.models.recipe import Recipe


class CookLog(Base):
    __tablename__ = "cook_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), index=True
    )
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"))
    servings_made: Mapped[int]
    rating: Mapped[int | None]
    cooked_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    recipe: Mapped[Recipe] = relationship(lazy="joined")
    user: Mapped[User | None] = relationship(lazy="joined")
    usages: Mapped[list["PantryUsage"]] = relationship(
        back_populates="cook_log", cascade="all, delete-orphan"
    )


class PantryUsage(Base):
    """Which batch a cooked meal drew from, so the log can be undone."""

    __tablename__ = "pantry_usages"

    id: Mapped[int] = mapped_column(primary_key=True)
    cook_log_id: Mapped[int] = mapped_column(ForeignKey("cook_logs.id", ondelete="CASCADE"))
    pantry_item_id: Mapped[int] = mapped_column(ForeignKey("pantry_items.id", ondelete="CASCADE"))
    # NULL when the batch had no tracked quantity (or units didn't match) and was used up.
    quantity_used: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    previous_status: Mapped[str] = mapped_column(String(16))

    cook_log: Mapped[CookLog] = relationship(back_populates="usages")
    pantry_item: Mapped[PantryItem] = relationship()
