import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.dependencies import get_current_user
from app.auth.router import router as auth_router
from app.core.config import settings
from app.api.v1.router import api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  [%(name)s] %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.WORKERS_ENABLED:
        from app.workers import scheduler
        scheduler.start()
    yield
    if settings.WORKERS_ENABLED:
        from app.workers import scheduler
        scheduler.stop()


app = FastAPI(
    title="TradeOps AI",
    version="0.1.0",
    redirect_slashes=False,
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(api_router, prefix="/api/v1", dependencies=[Depends(get_current_user)])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
