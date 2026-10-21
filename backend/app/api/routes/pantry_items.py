from fastapi import APIRouter, status

from app.api.deps import DbSession
from app.schemas.pantry_item import PantryItemCreate, PantryItemRead
from app.services import pantry_items as service

router = APIRouter(prefix="/pantry-items", tags=["pantry-items"])


@router.get("", response_model=list[PantryItemRead])
def list_pantry_items(db: DbSession):
    return service.list_pantry_items(db)


@router.post("", response_model=PantryItemRead, status_code=status.HTTP_201_CREATED)
def create_pantry_item(data: PantryItemCreate, db: DbSession):
    return service.create_pantry_item(db, data)
