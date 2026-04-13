"""FastAPI application factory with explicit lifespan management."""

from __future__ import annotations

from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from databricks.sdk import WorkspaceClient
from fastapi import APIRouter, FastAPI

from ._config import AppConfig, logger
from .lakebase import DatabaseConfig, create_db_engine, initialize_models, validate_db
from ..agent import init_agent_engine


API_PREFIX = "/api"
APP_NAME = "db-residential-copilot"
DIST_DIR = Path(__file__).parent.parent.parent / "__dist__"


@asynccontextmanager
async def _lifespan(app: FastAPI):
    # 1. Config
    config = AppConfig()
    app.state.config = config
    logger.info(f"Starting app with configuration:\n{config}")

    # 2. WorkspaceClient (SP credentials from Databricks Apps framework)
    ws = WorkspaceClient()
    app.state.workspace_client = ws

    # 3. Lakebase engine (OAuth token auth for Autoscale)
    db_config = DatabaseConfig()  # ty: ignore[missing-argument]
    engine = create_db_engine(db_config, ws=ws)
    try:
        validate_db(engine, db_config)
    except Exception as e:
        logger.error(f"DB validation failed (continuing anyway): {e}")
    try:
        initialize_models(engine)
    except Exception as e:
        logger.error(f"Model init failed (continuing anyway): {e}")
    app.state.engine = engine

    # 4. Investment Copilot agent (LangGraph, in-process)
    try:
        agent = init_agent_engine(engine, default_endpoint=config.llm_endpoint)
        app.state.agent = agent
    except Exception as e:
        logger.error(f"Agent init failed (continuing anyway): {e}")
        app.state.agent = None

    yield

    engine.dispose()


def create_app(
    *,
    routers: list[APIRouter] | None = None,
) -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title=APP_NAME, lifespan=_lifespan)

    api_router = create_router()
    app.include_router(api_router)

    for router in routers or []:
        if router is not api_router:
            app.include_router(router)

    if DIST_DIR.exists():
        from ._static import CachedStaticFiles, add_not_found_handler

        app.mount("/", CachedStaticFiles(directory=DIST_DIR, html=True))
        add_not_found_handler(app)

    return app


@lru_cache(maxsize=1)
def create_router() -> APIRouter:
    """Return the singleton APIRouter with the API prefix."""
    return APIRouter(prefix=API_PREFIX)
