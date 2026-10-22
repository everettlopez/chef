from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Household, Ingredient, PantryItem, User
from app.schemas.pantry_item import PantryItemCreate, PantryItemUpdate
from app.services import ingredients
from app.services.errors import NotFoundError


def estimate_expiry(ingredient: Ingredient, storage: str, purchased_on: date) -> date | None:
    shelf_days = {
        "pantry": ingredient.shelf_days_pantry,
        "fridge": ingredient.shelf_days_fridge,
        "freezer": ingredient.shelf_days_freezer,
    }[storage]
    return purchased_on + timedelta(days=shelf_days) if shelf_days is not None else None


def list_pantry_items(db: Session, household: Household) -> list[PantryItem]:
    return list(
        db.scalars(
            select(PantryItem)
            .where(PantryItem.household_id == household.id, PantryItem.status == "active")
            # Soonest-expiring first; items with no date last.
            .order_by(PantryItem.expires_on.is_(None), PantryItem.expires_on, PantryItem.id)
        )
    )


def get_pantry_item(db: Session, household: Household, item_id: int) -> PantryItem:
    item = db.get(PantryItem, item_id)
    if item is None or item.household_id != household.id:
        raise NotFoundError("Pantry item not found")
    return item


def create_pantry_item(
    db: Session, household: Household, user: User, data: PantryItemCreate
) -> PantryItem:
    if data.ingredient_id is not None:
        ingredient = db.get(Ingredient, data.ingredient_id)
        if ingredient is None:
            raise NotFoundError("Ingredient not found")
    else:
        assert data.name is not None
        ingredient, _ = ingredients.get_or_create(db, data.name)

    purchased_on = data.purchased_on or date.today()
    item = PantryItem(
        household_id=household.id,
        ingredient=ingredient,
        quantity=data.quantity,
        unit=ingredients.normalize_unit(data.unit)
        or (ingredient.default_unit if data.quantity is not None else None),
        storage=data.storage,
        purchased_on=purchased_on,
        expires_on=data.expires_on or estimate_expiry(ingredient, data.storage, purchased_on),
        expiry_estimated=data.expires_on is None,
        status="active",
        added_by=user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_pantry_item(
    db: Session, household: Household, item_id: int, data: PantryItemUpdate
) -> PantryItem:
    item = get_pantry_item(db, household, item_id)
    fields = data.model_dump(exclude_unset=True)

    if "quantity" in fields:
        item.quantity = data.quantity
    if "unit" in fields:
        item.unit = ingredients.normalize_unit(data.unit)
    if data.storage is not None:
        item.storage = data.storage
    if data.purchased_on is not None:
        item.purchased_on = data.purchased_on
    if data.status is not None:
        item.status = data.status

    if data.expires_on is not None:
        item.expires_on = data.expires_on
        item.expiry_estimated = False
    elif data.use_estimate:
        item.expiry_estimated = True
    if item.expiry_estimated:
        item.expires_on = estimate_expiry(item.ingredient, item.storage, item.purchased_on)

    db.commit()
    db.refresh(item)
    return item


def discard_pantry_item(db: Session, household: Household, item_id: int) -> None:
    # Soft delete: discarded batches are kept for a future waste report.
    item = get_pantry_item(db, household, item_id)
    item.status = "discarded"
    db.commit()
