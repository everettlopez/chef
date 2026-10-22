from fastapi import APIRouter

from app.api.deps import CurrentHousehold, CurrentUser, DbSession
from app.schemas.household import HouseholdRead, HouseholdUpdate, JoinRequest
from app.services import households as service

router = APIRouter(prefix="/household", tags=["household"])


@router.get("", response_model=HouseholdRead)
def get_household(household: CurrentHousehold):
    return service.to_read(household)


@router.patch("", response_model=HouseholdRead)
def rename_household(data: HouseholdUpdate, household: CurrentHousehold, db: DbSession):
    return service.to_read(service.rename(db, household, data.name))


@router.post("/invite-code", response_model=HouseholdRead)
def regenerate_invite_code(household: CurrentHousehold, db: DbSession):
    return service.to_read(service.regenerate_invite_code(db, household))


@router.post("/join", response_model=HouseholdRead)
def join_household(data: JoinRequest, user: CurrentUser, db: DbSession):
    return service.to_read(service.join(db, user, data.invite_code))
