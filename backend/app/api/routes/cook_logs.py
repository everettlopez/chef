from fastapi import APIRouter, status

from app.api.deps import CurrentHousehold, CurrentUser, DbSession
from app.schemas.cook_log import CookLogCreate, CookLogRead
from app.services import cook_logs as service

router = APIRouter(prefix="/cook-logs", tags=["cook-logs"])


@router.get("", response_model=list[CookLogRead])
def list_cook_logs(db: DbSession, household: CurrentHousehold):
    return [service.to_read(log) for log in service.list_cook_logs(db, household)]


@router.post("", response_model=CookLogRead, status_code=status.HTTP_201_CREATED)
def log_cook(data: CookLogCreate, db: DbSession, household: CurrentHousehold, user: CurrentUser):
    return service.to_read(service.log_cook(db, household, user, data))


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def undo_cook_log(log_id: int, db: DbSession, household: CurrentHousehold) -> None:
    """Undo: restore the pantry batches the meal drew from and delete the log."""
    service.undo_cook_log(db, household, log_id)
