import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import fields, games, health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Boiska Poznań API",
    version="0.1.0",
    description=(
        "REST API dla agregatora boisk sportowych w Poznaniu. "
        "Udostępnia listę boisk, ogłoszenia graczy i integracje z zewnętrznymi źródłami danych."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(health.router, tags=["health"])
app.include_router(fields.router, prefix="/fields", tags=["fields"])
app.include_router(games.router, prefix="/games", tags=["games"])


# ---------------------------------------------------------------------------
# Lifecycle events
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Boiska Poznań API started (version %s)", app.version)
    logger.info("Allowed CORS origins: %s", settings.allowed_origins)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    logger.info("Boiska Poznań API shutting down")
