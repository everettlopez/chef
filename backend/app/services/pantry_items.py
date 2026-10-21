from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PantryItem
from app.schemas.pantry_item import PantryItemCreate


def list_pantry_items(db: Session) -> list[PantryItem]:
    return list(db.scalars(select(PantryItem).order_by(PantryItem.id.desc())))


def create_pantry_item(db: Session, data: PantryItemCreate) -> PantryItem:
    item = PantryItem(**data.model_dump())
    db.add(item)
    db.commit()
    # Load server-generated columns (created_at, updated_at).
    db.refresh(item)
    return item
