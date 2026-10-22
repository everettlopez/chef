import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_secure_cookies_require_a_real_secret() -> None:
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(session_cookie_secure=True, _env_file=None)

    assert Settings(session_cookie_secure=True, secret_key="x" * 40, _env_file=None)
