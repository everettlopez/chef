from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    engine = create_engine(get_settings().test_database_url, pool_pre_ping=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
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
