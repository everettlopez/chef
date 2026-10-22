from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import DietaryTag, User, UserDietPref
from app.schemas.recipe import DietPref
from app.services.errors import NotFoundError


def list_tags(db: Session) -> list[DietaryTag]:
    return list(db.scalars(select(DietaryTag).order_by(DietaryTag.kind, DietaryTag.name)))


def get_prefs(db: Session, user: User) -> list[UserDietPref]:
    return list(db.scalars(select(UserDietPref).where(UserDietPref.user_id == user.id)))


def set_prefs(db: Session, user: User, prefs: list[DietPref]) -> list[UserDietPref]:
    """Replace the user's preferences with `prefs`."""
    by_tag = {p.tag_id: p.mode for p in prefs}
    known = set(db.scalars(select(DietaryTag.id).where(DietaryTag.id.in_(by_tag))))
    if unknown := set(by_tag) - known:
        raise NotFoundError(f"Unknown dietary tag id(s): {sorted(unknown)}")

    db.execute(delete(UserDietPref).where(UserDietPref.user_id == user.id))
    db.add_all(UserDietPref(user_id=user.id, tag_id=t, mode=m) for t, m in by_tag.items())
    db.commit()
    return get_prefs(db, user)
