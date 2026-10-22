import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from app.main import app
from app.services.errors import (
    AuthError,
    ConflictError,
    InvalidInputError,
    NotFoundError,
    ServiceError,
)

_router = APIRouter()


@_router.get("/_raise/{name}")
def _raise(name: str) -> None:
    errors = {
        "not-found": NotFoundError,
        "conflict": ConflictError,
        "auth": AuthError,
        "invalid": InvalidInputError,
        "other": ServiceError,
    }
    raise errors[name](f"{name} happened")


@pytest.fixture
def raising_client(client: TestClient):
    app.include_router(_router, prefix="/api")
    yield client
    app.router.routes[:] = [
        r for r in app.router.routes if "/_raise/" not in getattr(r, "path", "")
    ]


@pytest.mark.parametrize(
    ("name", "status"),
    [("not-found", 404), ("conflict", 409), ("auth", 401), ("invalid", 422), ("other", 400)],
)
def test_service_errors_map_to_status_codes(
    raising_client: TestClient, name: str, status: int
) -> None:
    response = raising_client.get(f"/api/_raise/{name}")

    assert response.status_code == status
    assert response.json() == {"detail": f"{name} happened"}


def test_unknown_route_is_404(client: TestClient) -> None:
    assert client.get("/api/nope").status_code == 404


def test_cors_allows_the_dev_frontend(client: TestClient) -> None:
    response = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_rejects_other_origins(client: TestClient) -> None:
    response = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers
