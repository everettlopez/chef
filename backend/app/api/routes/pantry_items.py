from fastapi import APIRouter, status

from app.api.deps import CurrentHousehold, CurrentUser, DbSession
from app.schemas.pantry_item import PantryItemCreate, PantryItemRead, PantryItemUpdate
from app.services import pantry_items as service

router = APIRouter(prefix="/pantry", tags=["pantry"])


@router.get("", response_model=list[PantryItemRead])
def list_pantry_items(household: CurrentHousehold, db: DbSession):
    return service.list_pantry_items(db, household)


@router.post("", response_model=PantryItemRead, status_code=status.HTTP_201_CREATED)
def create_pantry_item(
    data: PantryItemCreate, household: CurrentHousehold, user: CurrentUser, db: DbSession
):
    return service.create_pantry_item(db, household, user, data)


@router.patch("/{item_id}", response_model=PantryItemRead)
def update_pantry_item(
    item_id: int, data: PantryItemUpdate, household: CurrentHousehold, db: DbSession
):
    return service.update_pantry_item(db, household, item_id, data)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def discard_pantry_item(item_id: int, household: CurrentHousehold, db: DbSession) -> None:
    service.discard_pantry_item(db, household, item_id)
