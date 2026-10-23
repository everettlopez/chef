from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core import security
from app.core.config import get_settings


def test_password_hash_round_trip() -> None:
    hashed = security.hash_password("correct-horse")

    assert hashed != "correct-horse"
    assert hashed.startswith("$argon2")
    assert security.verify_password(hashed, "correct-horse") is True
    assert security.verify_password(hashed, "wrong-horse") is False


def test_hashes_are_salted() -> None:
    assert security.hash_password("same") != security.hash_password("same")


def test_garbage_hash_does_not_raise() -> None:
    assert security.verify_password("not-a-hash", "anything") is False


def test_session_token_round_trip() -> None:
    assert security.read_session_token(security.create_session_token(42)) == 42


def test_expired_token_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "session_days", -1)
    assert security.read_session_token(security.create_session_token(42)) is None


def _sign(payload: dict, key: str | None = None) -> str:
    return jwt.encode(payload, key or get_settings().secret_key, "HS256")


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(_sign({"sub": "42"}, key="some-other-secret-key-of-enough-length"),
                     id="wrong secret"),
        pytest.param(_sign({"exp": datetime.now(UTC) + timedelta(days=1)}), id="no sub"),
        pytest.param(_sign({"sub": "abc"}), id="non-numeric sub"),
        pytest.param("a.b.c", id="malformed"),
        pytest.param("", id="empty"),
    ],
)  # fmt: skip
def test_bad_tokens_are_rejected(token: str) -> None:
    assert security.read_session_token(token) is None


@pytest.mark.filterwarnings("ignore::jwt.warnings.InsecureKeyLengthWarning")
def test_other_algorithms_are_rejected() -> None:
    token = jwt.encode({"sub": "42"}, get_settings().secret_key, "HS512")
    assert security.read_session_token(token) is None
