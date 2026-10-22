from fastapi.testclient import TestClient

from app.core.security import create_session_token
from tests.conftest import SignUp


def test_signup_sets_session_and_creates_household(sign_up: SignUp) -> None:
    client = sign_up("Ana@Example.com", "Ana")

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "ana@example.com"

    household = client.get("/api/household").json()
    assert household["name"] == "Ana's Kitchen"
    assert len(household["invite_code"]) == 8
    assert [m["role"] for m in household["members"]] == ["owner"]


def test_session_cookie_is_http_only(client: TestClient) -> None:
    response = client.post(
        "/api/auth/signup",
        json={"email": "a@b.co", "password": "correct-horse", "display_name": "A"},
    )
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie


def test_duplicate_email_conflicts(sign_up: SignUp, client: TestClient) -> None:
    sign_up("dup@example.com")
    response = client.post(
        "/api/auth/signup",
        json={"email": "DUP@example.com", "password": "correct-horse", "display_name": "X"},
    )
    assert response.status_code == 409


def test_signup_validates_input(client: TestClient) -> None:
    short = client.post(
        "/api/auth/signup", json={"email": "a@b.co", "password": "short", "display_name": "A"}
    )
    bad_email = client.post(
        "/api/auth/signup",
        json={"email": "nope", "password": "correct-horse", "display_name": "A"},
    )
    assert short.status_code == 422
    assert bad_email.status_code == 422


def test_login_logout_round_trip(sign_up: SignUp, client: TestClient) -> None:
    sign_up("login@example.com")

    wrong = client.post(
        "/api/auth/login", json={"email": "login@example.com", "password": "wrong-password"}
    )
    assert wrong.status_code == 401

    ok = client.post(
        "/api/auth/login", json={"email": "login@example.com", "password": "correct-horse"}
    )
    assert ok.status_code == 200
    assert client.get("/api/auth/me").status_code == 200

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_protected_routes_require_session(client: TestClient) -> None:
    for path in ("/api/pantry", "/api/household", "/api/recipes", "/api/cook-logs"):
        assert client.get(path).status_code == 401, path


def test_tampered_cookie_is_rejected(client: TestClient) -> None:
    client.cookies.set("chef_session", "not-a-real-token")
    assert client.get("/api/auth/me").status_code == 401


def test_login_failures_do_not_reveal_which_part_was_wrong(
    sign_up: SignUp, client: TestClient
) -> None:
    sign_up("known@example.com")

    wrong_password = client.post(
        "/api/auth/login", json={"email": "known@example.com", "password": "wrong-password"}
    )
    unknown_email = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "correct-horse"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert "set-cookie" not in wrong_password.headers


def test_login_normalizes_email(sign_up: SignUp, client: TestClient) -> None:
    sign_up("  Mixed@Example.COM ")

    response = client.post(
        "/api/auth/login", json={"email": " MIXED@example.com", "password": "correct-horse"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == "mixed@example.com"


def test_signup_requires_display_name(client: TestClient) -> None:
    response = client.post(
        "/api/auth/signup",
        json={"email": "a@b.co", "password": "correct-horse", "display_name": "   "},
    )
    assert response.status_code == 422


def test_logout_without_a_session_is_harmless(client: TestClient) -> None:
    assert client.post("/api/auth/logout").status_code == 204


def test_token_for_a_missing_user_is_rejected(client: TestClient) -> None:
    client.cookies.set("chef_session", create_session_token(999_999_999))
    assert client.get("/api/auth/me").status_code == 401


def test_me_returns_no_password_hash(auth_client: TestClient) -> None:
    assert set(auth_client.get("/api/auth/me").json()) == {"id", "email", "display_name"}
