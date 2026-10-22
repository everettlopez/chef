from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentHousehold, CurrentUser, DbSession
from app.schemas.recipe import RecipeDetail, RecipeSummary, Recommendation
from app.services import recipes as service

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("", response_model=list[RecipeSummary])
def list_recipes(
    db: DbSession,
    _: CurrentUser,
    q: Annotated[str | None, Query(max_length=120)] = None,
    tag_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return service.list_recipes(db, q, tag_id, limit, offset)


# Declared before /{recipe_id} so "recommendations" isn't parsed as an id.
@router.get("/recommendations", response_model=list[Recommendation])
def recommend_recipes(
    db: DbSession,
    household: CurrentHousehold,
    user: CurrentUser,
    max_missing: Annotated[int | None, Query(ge=0, le=20)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    return service.recommend(db, household, user, max_missing, limit)


@router.get("/{recipe_id}", response_model=RecipeDetail)
def get_recipe(recipe_id: int, db: DbSession, household: CurrentHousehold):
    return service.get_recipe(db, household, recipe_id)
