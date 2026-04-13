"""Lakebase (Databricks Database) integration: config, engine, session, and dependency.

Production auth uses OAuth tokens generated via the Databricks SDK.  Tokens
expire after 1 hour; a daemon thread refreshes them every 50 minutes and the
SQLAlchemy ``do_connect`` event injects the current token on every new
physical connection.
"""

from __future__ import annotations

import os
import threading
import time
from collections.abc import Generator
from typing import Annotated, Any, TypeAlias
from urllib.parse import quote_plus

from fastapi import Depends, Request
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Engine, create_engine, event
from sqlmodel import Session, SQLModel, text

from ._config import logger

# Lakebase Autoscale endpoint resource name (used for credential generation).
_LAKEBASE_ENDPOINT = (
    "projects/db-residential-copilot/branches/production/endpoints/primary"
)

# Token refresh interval — 50 minutes (tokens expire at 60).
_TOKEN_REFRESH_SECONDS = 50 * 60


# --- Database Config ---


class DatabaseConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="")

    host: str = Field(
        description="The database host", validation_alias="PGHOST"
    )
    port: int = Field(
        description="The port of the database", default=5432, validation_alias="PGPORT"
    )
    database_name: str = Field(
        description="The name of the database", default="databricks_postgres",
        validation_alias="PGDATABASE",
    )


# --- OAuth token management ---

_current_token: str | None = None
_token_lock = threading.Lock()


def _generate_token(ws: Any) -> str:
    """Generate a fresh OAuth token for Lakebase Autoscale."""
    cred = ws.postgres.generate_database_credential(endpoint=_LAKEBASE_ENDPOINT)
    return cred.token


def _token_refresh_loop(ws: Any) -> None:
    """Background daemon that refreshes the OAuth token every 50 minutes."""
    global _current_token
    while True:
        time.sleep(_TOKEN_REFRESH_SECONDS)
        try:
            token = _generate_token(ws)
            with _token_lock:
                _current_token = token
            logger.info("Lakebase OAuth token refreshed successfully")
        except Exception as e:
            logger.error(f"Lakebase OAuth token refresh failed: {e}")


# --- Engine creation ---


def _get_dev_db_port() -> int | None:
    """Check for APX_DEV_DB_PORT environment variable for local development."""
    port = os.environ.get("APX_DEV_DB_PORT")
    return int(port) if port else None


def create_db_engine(db_config: DatabaseConfig, ws: Any | None = None) -> Engine:
    """Create a SQLAlchemy engine.

    In dev mode: no SSL, password from APX_DEV_DB_PWD.
    In production: SSL required, OAuth token generated via WorkspaceClient
    and injected on every connection via SQLAlchemy ``do_connect`` event.
    """
    global _current_token

    dev_port = _get_dev_db_port()

    if dev_port:
        password = os.environ.get("APX_DEV_DB_PWD")
        if password is None:
            raise ValueError(
                "APX server didn't provide a password, please check the dev server logs"
            )
        logger.info(f"Using local dev database at localhost:{dev_port}")
        url = f"postgresql+psycopg://postgres:{password}@localhost:{dev_port}/postgres?sslmode=disable"
        return create_engine(url, pool_size=4, pool_recycle=45 * 60)

    # --- Production: OAuth token auth for Lakebase Autoscale ---
    if ws is None:
        raise ValueError("WorkspaceClient is required for production Lakebase auth")

    # Resolve the actual endpoint host from the Lakebase API.  PGHOST from the
    # Apps framework points to an internal gateway that doesn't accept OAuth
    # tokens; we must connect to the project endpoint directly.
    try:
        ep = ws.postgres.get_endpoint(name=_LAKEBASE_ENDPOINT)
        host = ep.status.hosts.host
        logger.info(f"Resolved Lakebase endpoint host: {host}")
    except Exception as e:
        logger.warning(f"get_endpoint failed ({e}), falling back to PGHOST")
        host = db_config.host
    port = db_config.port
    database = db_config.database_name

    # Resolve username: prefer PGUSER env var, then SP client ID from WorkspaceClient.
    # Lakebase Autoscale requires the SP client ID (or user email) as the Postgres username.
    username = os.environ.get("PGUSER", "")
    if not username:
        try:
            me = ws.current_user.me()
            # Service principals have application_id; users have user_name
            username = getattr(me, "application_id", None) or me.user_name or ""
            logger.info(f"Resolved database username from SDK: {username}")
        except Exception as e:
            logger.warning(f"Could not resolve username from SDK: {e}")

    # Generate initial OAuth token
    _current_token = _generate_token(ws)
    logger.info(f"Connecting to Lakebase at {host}:{port}/{database}")

    # Build URL WITHOUT password — injected via do_connect event
    url = (
        f"postgresql+psycopg://{quote_plus(username)}"
        f"@{host}:{port}/{database}"
    )

    engine = create_engine(
        url,
        pool_size=4,
        pool_recycle=45 * 60,
        connect_args={"sslmode": "require"},
    )

    # Inject the current OAuth token as password on every new connection
    @event.listens_for(engine, "do_connect")
    def _inject_token(dialect, conn_rec, cargs, cparams):  # noqa: ANN001
        with _token_lock:
            cparams["password"] = _current_token

    # Start background token refresh daemon
    refresh = threading.Thread(
        target=_token_refresh_loop,
        args=(ws,),
        daemon=True,
        name="lakebase-token-refresh",
    )
    refresh.start()
    logger.info("Lakebase token refresh daemon started")

    return engine


def validate_db(engine: Engine, db_config: DatabaseConfig) -> None:
    """Validate that the database connection works."""
    dev_port = _get_dev_db_port()

    if dev_port:
        logger.info(f"Validating local dev database connection at localhost:{dev_port}")
    else:
        logger.info(
            f"Validating connection to Lakebase at {db_config.host}"
        )

    try:
        with Session(engine) as session:
            session.connection().execute(text("SELECT 1"))
            session.close()
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise ConnectionError(f"Failed to connect to the database: {e}")

    if dev_port:
        logger.info("Local dev database connection validated successfully")
    else:
        logger.info(
            f"Lakebase connection to {db_config.host} validated successfully"
        )


def initialize_models(engine: Engine) -> None:
    """Create app-writable tables (deal_scenarios, chat_audit).

    Synced tables (dbx_res_gold.portfolio_metrics, dbx_res_gold.portfolio_time_series) are
    managed by the Lakebase sync pipeline and must NOT be created here.
    """
    logger.info("Initializing app-writable database models")
    app_tables = [
        table
        for table in SQLModel.metadata.sorted_tables
        if table.schema == "dbx_res_app"
    ]
    SQLModel.metadata.create_all(engine, tables=app_tables)
    logger.info("App-writable database models initialized successfully")


# --- Dependency ---


def _get_session(request: Request) -> Generator[Session, None, None]:
    with Session(bind=request.app.state.engine) as session:
        yield session


LakebaseDependency: TypeAlias = Annotated[Session, Depends(_get_session)]
