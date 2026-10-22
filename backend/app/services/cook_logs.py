"""Logging a cooked recipe deducts ingredients from the pantry, oldest-expiring batch first.

Each batch touched gets a PANTRY_USAGES row, so a log can be undone exactly. Batches with no
tracked quantity ("have some") are left alone, since we can't know when they run out. When a
recipe amount can't be converted to the batch's unit, that batch is marked used.
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import CookLog, Household, PantryItem, PantryUsage, Recipe, User
from app.schemas.cook_log import CookLogCreate, CookLogRead, UsageRead
from app.services.errors import NotFoundError
from app.services.ingredients import convert
from app.services.recipes import STAPLE


def _active_batches(db: Session, household: Household, ingredient_id: int) -> list[PantryItem]:
    return list(
        db.scalars(
            select(PantryItem)
            .where(
                PantryItem.household_id == household.id,
                PantryItem.ingredient_id == ingredient_id,
                PantryItem.status == "active",
            )
            .order_by(
                PantryItem.expires_on.is_(None),
                PantryItem.expires_on,
                PantryItem.purchased_on,
                PantryItem.id,
            )
        )
    )


def _deduct(log: CookLog, batches: list[PantryItem], needed: Decimal | None, unit: str | None):
    remaining = needed
    for batch in batches:
        if batch.quantity is None:
            continue
        amount = convert(remaining, unit, batch.unit) if remaining is not None else None
        if amount is None:
            log.usages.append(
                PantryUsage(pantry_item=batch, quantity_used=None, previous_status=batch.status)
            )
            batch.status = "used"
            return

        take = min(batch.quantity, amount)
        log.usages.append(
            PantryUsage(pantry_item=batch, quantity_used=take, previous_status=batch.status)
        )
        batch.quantity -= take
        if batch.quantity <= 0:
            batch.status = "used"

        # The units converted one way above, so they convert back.
        assert remaining is not None
        remaining -= convert(take, batch.unit, unit) or Decimal(0)
        if remaining <= 0:
            return


def log_cook(db: Session, household: Household, user: User, data: CookLogCreate) -> CookLog:
    recipe = db.get(Recipe, data.recipe_id, options=[selectinload(Recipe.ingredients)])
    if recipe is None:
        raise NotFoundError("Recipe not found")

    servings = data.servings_made or recipe.servings
    scale = Decimal(servings) / Decimal(recipe.servings)
    log = CookLog(user_id=user.id, household_id=household.id, recipe=recipe, servings_made=servings)
    db.add(log)

    for line in recipe.ingredients:
        ingredient = line.ingredient
        if line.optional or ingredient is None or ingredient.category == STAPLE:
            continue
        batches = _active_batches(db, household, ingredient.id)
        needed = (
            (line.quantity * scale).quantize(Decimal("0.01")) if line.quantity is not None else None
        )
        _deduct(log, batches, needed, line.unit)

    db.commit()
    db.refresh(log)
    return log


def list_cook_logs(db: Session, household: Household, limit: int = 50) -> list[CookLog]:
    return list(
        db.scalars(
            select(CookLog)
            .where(CookLog.household_id == household.id)
            .options(selectinload(CookLog.usages).selectinload(PantryUsage.pantry_item))
            .order_by(CookLog.cooked_at.desc(), CookLog.id.desc())
            .limit(limit)
        ).unique()
    )


def undo_cook_log(db: Session, household: Household, log_id: int) -> None:
    log = db.get(CookLog, log_id)
    if log is None or log.household_id != household.id:
        raise NotFoundError("Cook log not found")
    for usage in log.usages:
        batch = usage.pantry_item
        if usage.quantity_used is not None and batch.quantity is not None:
            batch.quantity += usage.quantity_used
        batch.status = usage.previous_status
    db.delete(log)
    db.commit()


def to_read(log: CookLog) -> CookLogRead:
    return CookLogRead(
        id=log.id,
        recipe_id=log.recipe_id,
        recipe_title=log.recipe.title,
        servings_made=log.servings_made,
        cooked_by=log.user.display_name if log.user else None,
        cooked_at=log.cooked_at,
        usages=[
            UsageRead(
                pantry_item_id=u.pantry_item_id,
                ingredient_name=u.pantry_item.ingredient.canonical_name,
                quantity_used=float(u.quantity_used) if u.quantity_used is not None else None,
                unit=u.pantry_item.unit,
            )
            for u in log.usages
        ],
    )
