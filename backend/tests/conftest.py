from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.seed import run as load_seed_data


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    engine = create_engine(get_settings().test_database_url, pool_pre_ping=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    # Curated ingredients, tags and recipes are shared, read-mostly fixtures for every test.
    with Session(engine) as db:
        load_seed_data(db)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    """Each test runs inside a transaction that is rolled back afterwards.

    Commits made by app code only release a savepoint, so nothing persists.
    """
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


SignUp = Callable[..., TestClient]


@pytest.fixture
def sign_up(db_session: Session) -> Iterator[SignUp]:
    """Factory for signed-in clients; each has its own cookie jar (one user each)."""
    app.dependency_overrides[get_db] = lambda: db_session
    clients: list[TestClient] = []

    def make(email: str = "cook@example.com", name: str = "Cook") -> TestClient:
        test_client = TestClient(app)
        response = test_client.post(
            "/api/auth/signup",
            json={"email": email, "password": "correct-horse", "display_name": name},
        )
        assert response.status_code == 201, response.text
        clients.append(test_client)
        return test_client

    yield make
    for test_client in clients:
        test_client.close()
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client(sign_up: SignUp) -> TestClient:
    return sign_up()


def ingredient_id(db: Session, name: str) -> int:
    from sqlalchemy import select

    from app.models import Ingredient

    found = db.scalar(select(Ingredient.id).where(Ingredient.canonical_name == name))
    assert found is not None, name
    return found
