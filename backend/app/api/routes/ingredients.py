from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.pantry_item import IngredientRead
from app.services import ingredients as service

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.get("", response_model=list[IngredientRead])
def search_ingredients(
    db: DbSession,
    _: CurrentUser,
    q: Annotated[str, Query(min_length=1, max_length=120)],
    limit: Annotated[int, Query(ge=1, le=20)] = 8,
):
    return service.search(db, q, limit)
