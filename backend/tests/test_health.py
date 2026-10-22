from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.main import app


def test_health_reports_database_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_reports_database_down() -> None:
    # Nothing listens on port 1, so the first query fails.
    dead = create_engine(
        "mysql+pymysql://nobody:x@127.0.0.1:1/none", connect_args={"connect_timeout": 1}
    )
    app.dependency_overrides[get_db] = lambda: Session(dead)
    try:
        with TestClient(app) as client:
            response = client.get("/api/health")
    finally:
        app.dependency_overrides.clear()
        dead.dispose()

    assert response.status_code == 503
    assert response.json() == {"detail": {"status": "degraded", "database": "unavailable"}}
