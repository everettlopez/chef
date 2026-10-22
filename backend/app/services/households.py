import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Household, HouseholdMember, User
from app.schemas.household import HouseholdRead, MemberRead
from app.services.errors import NotFoundError

# No 0/O or 1/I, so codes are easy to read aloud.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 8


def new_invite_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
        if db.scalar(select(Household.id).where(Household.invite_code == code)) is None:
            return code


def create_household_for(db: Session, user: User, name: str) -> Household:
    """Give a user a household of one. Caller commits."""
    household = Household(name=name, invite_code=new_invite_code(db))
    household.members.append(HouseholdMember(user=user, role="owner"))
    db.add(household)
    return household


def to_read(household: Household) -> HouseholdRead:
    return HouseholdRead(
        id=household.id,
        name=household.name,
        invite_code=household.invite_code,
        members=[
            MemberRead(
                user_id=m.user_id,
                display_name=m.user.display_name,
                email=m.user.email,
                role=m.role,
            )
            for m in sorted(household.members, key=lambda m: m.user_id)
        ],
    )


def rename(db: Session, household: Household, name: str) -> Household:
    household.name = name
    db.commit()
    return household


def regenerate_invite_code(db: Session, household: Household) -> Household:
    household.invite_code = new_invite_code(db)
    db.commit()
    return household


def join(db: Session, user: User, invite_code: str) -> Household:
    target = db.scalar(select(Household).where(Household.invite_code == invite_code.upper()))
    if target is None:
        raise NotFoundError("No household has that invite code")

    current = user.membership
    if current is not None and current.household_id == target.id:
        return target

    if current is not None:
        old = current.household
        was_owner = current.role == "owner"
        db.delete(current)
        db.flush()
        db.expire(user, ["membership"])
        db.expire(old, ["members"])
        # Drop the old household (and its pantry) only if nobody is left in it.
        if not old.members:
            db.delete(old)
        elif was_owner:
            old.members[0].role = "owner"

    db.add(HouseholdMember(household_id=target.id, user_id=user.id, role="member"))
    db.commit()
    db.expire(target, ["members"])
    db.expire(user, ["membership"])
    return target
