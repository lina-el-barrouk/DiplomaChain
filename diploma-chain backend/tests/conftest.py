"""
DiplomaChain – Configuration pytest + fixtures communes
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Base de données SQLite en mémoire pour les tests
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-chars-long-for-tests")
os.environ.setdefault("DB_USER", "test")
os.environ.setdefault("DB_PASSWORD", "test")
os.environ.setdefault("HEDERA_OPERATOR_ID", "0.0.12345")
os.environ.setdefault("HEDERA_OPERATOR_PRIVATE_KEY", "302e020100300506032b657004220420" + "a" * 32)
os.environ.setdefault("HEDERA_TOPIC_ID", "0.0.99999")

SQLALCHEMY_TEST_URL = "sqlite:///:memory:"


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        SQLALCHEMY_TEST_URL,
        connect_args={"check_same_thread": False},
    )
    from app.db.database import Base
    from app.models.models import (  # noqa
        Diploma, Institution, RevokedToken, Student, User, VerificationLog,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_engine):
    TestingSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(db_session):
    from app.main import app
    from app.db.database import get_db

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
