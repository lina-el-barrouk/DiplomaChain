"""
DiplomaChain – Connexion MySQL via SQLAlchemy 2.0 (async-ready)
"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,          # vérifie la connexion avant chaque requête
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,           # recycle les connexions après 30 min
    echo=settings.DEBUG,
)


# Forcer l'UTF-8 et le mode SQL strict à chaque nouvelle connexion
@event.listens_for(engine, "connect")
def set_mysql_pragmas(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci")
    cursor.execute("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'")
    cursor.close()


# ── Session factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# ── Base déclarative ─────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dépendance FastAPI ────────────────────────────────────────────────────────
def get_db():
    """
    Générateur de session DB pour injection de dépendances FastAPI.
    La session est fermée automatiquement après chaque requête.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
