"""
DiplomaChain – Point d'entrée FastAPI (version complète)
"""
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.diplomas import router as diplomas_router
from app.api.v1.endpoints.institutions import router as institutions_router
from app.api.v1.endpoints.qr import router as qr_router
from app.api.v1.endpoints.students import router as students_router
from app.core.config import settings
from app.db.database import Base, engine

from app.api.v1.endpoints.pdf import router as pdf_router

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("diplomachain")

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.MAX_REQUESTS_PER_MINUTE}/minute"],
    storage_uri=settings.REDIS_URL,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info(f"✅ DiplomaChain {settings.APP_VERSION} — Hedera: {settings.HEDERA_NETWORK}")
    yield
    logger.info("🛑 DiplomaChain arrêté")


app = FastAPI(
    title="DiplomaChain API",
    description="Système de diplômes infalsifiables ancré sur Hedera Hashgraph",
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


@app.middleware("http")
async def request_logging(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    logger.info(f"{request.method} {request.url.path} {response.status_code} {ms:.1f}ms")
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Erreur non gérée: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Erreur interne du serveur"},
    )


PREFIX = "/api/v1"
app.include_router(auth_router,         prefix=PREFIX)
app.include_router(institutions_router, prefix=PREFIX)
app.include_router(students_router,     prefix=PREFIX)
app.include_router(diplomas_router,     prefix=PREFIX)
app.include_router(qr_router,           prefix=PREFIX)
app.include_router(admin_router,        prefix=PREFIX)
app.include_router(pdf_router,          prefix=PREFIX)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "hedera_network": settings.HEDERA_NETWORK,
        "hedera_topic": settings.HEDERA_TOPIC_ID,
    }


@app.get("/", include_in_schema=False)
def root():
    return {"app": "DiplomaChain API", "version": settings.APP_VERSION}
