from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.recipe import DietPrefRead, DietPrefsUpdate, TagRead
from app.services import diet as service

router = APIRouter(tags=["diet"])


@router.get("/dietary-tags", response_model=list[TagRead])
def list_dietary_tags(db: DbSession, _: CurrentUser):
    return service.list_tags(db)


@router.get("/me/diet-prefs", response_model=list[DietPrefRead])
def get_diet_prefs(db: DbSession, user: CurrentUser):
    return service.get_prefs(db, user)


@router.put("/me/diet-prefs", response_model=list[DietPrefRead])
def set_diet_prefs(data: DietPrefsUpdate, db: DbSession, user: CurrentUser):
    return service.set_prefs(db, user, data.prefs)
