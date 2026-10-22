from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models import User
from app.schemas.auth import LoginRequest, SignupRequest
from app.services import households
from app.services.errors import AuthError, ConflictError


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def signup(db: Session, data: SignupRequest) -> User:
    email = _normalize_email(data.email)
    if db.scalar(select(User.id).where(func.lower(User.email) == email)) is not None:
        raise ConflictError("An account with that email already exists")

    user = User(
        email=email,
        password_hash=hash_password(data.password),
        display_name=data.display_name,
    )
    db.add(user)
    households.create_household_for(db, user, f"{data.display_name}'s Kitchen")
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, data: LoginRequest) -> User:
    user = db.scalar(select(User).where(User.email == _normalize_email(data.email)))
    if user is None or not verify_password(user.password_hash, data.password):
        raise AuthError("Incorrect email or password")
    return user
