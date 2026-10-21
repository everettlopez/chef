from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), server_default="1")
    unit: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
