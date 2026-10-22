from pydantic import BaseModel, ConfigDict, Field


class MemberRead(BaseModel):
    user_id: int
    display_name: str
    email: str
    role: str


class HouseholdRead(BaseModel):
    id: int
    name: str
    invite_code: str
    members: list[MemberRead]


class HouseholdUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=80)


class JoinRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    invite_code: str = Field(min_length=4, max_length=16)
