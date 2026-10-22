from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.security import create_session_token
from app.schemas.auth import LoginRequest, SignupRequest, UserRead
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user_id: int) -> None:
    settings = get_settings()
    response.set_cookie(
        settings.session_cookie_name,
        create_session_token(user_id),
        max_age=settings.session_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest, response: Response, db: DbSession):
    user = service.signup(db, data)
    _set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserRead)
def login(data: LoginRequest, response: Response, db: DbSession):
    user = service.authenticate(db, data)
    _set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(get_settings().session_cookie_name, path="/")


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser):
    return user
