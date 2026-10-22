from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.recipe import DietaryTag


class UserDietPref(Base):
    __tablename__ = "user_diet_prefs"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("dietary_tags.id", ondelete="CASCADE"), primary_key=True
    )
    # "require": recipes must carry the tag; "avoid": recipes must not.
    mode: Mapped[str] = mapped_column(String(16))

    tag: Mapped[DietaryTag] = relationship(lazy="joined")
