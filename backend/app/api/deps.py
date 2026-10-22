from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import read_session_token
from app.db.session import get_db
from app.models import Household, User

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    chef_session: Annotated[str | None, Cookie(alias=get_settings().session_cookie_name)] = None,
) -> User:
    user_id = read_session_token(chef_session) if chef_session else None
    user = db.get(User, user_id) if user_id is not None else None
    if user is None or user.membership is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_household(user: CurrentUser) -> Household:
    assert user.membership is not None  # guaranteed by get_current_user
    return user.membership.household


CurrentHousehold = Annotated[Household, Depends(get_current_household)]
