"""Default FastAPI dependencies: config, workspace client, user OBO client, agent."""

from __future__ import annotations

from typing import Annotated, Any, TypeAlias

from databricks.sdk import WorkspaceClient
from fastapi import Depends, Request

from ._config import AppConfig
from ._headers import HeadersDependency


def _get_config(request: Request) -> AppConfig:
    return request.app.state.config


def _get_workspace_client(request: Request) -> WorkspaceClient:
    return request.app.state.workspace_client


def _get_user_ws(headers: HeadersDependency) -> WorkspaceClient:
    """WorkspaceClient authenticated on behalf of the current user via OBO token."""
    if not headers.token:
        raise ValueError(
            "OBO token is not provided in the header X-Forwarded-Access-Token"
        )
    return WorkspaceClient(
        token=headers.token.get_secret_value(), auth_type="pat"
    )


def _get_agent(request: Request) -> Any:
    return request.app.state.agent


ConfigDependency: TypeAlias = Annotated[AppConfig, Depends(_get_config)]
ClientDependency: TypeAlias = Annotated[WorkspaceClient, Depends(_get_workspace_client)]
UserWorkspaceClientDependency: TypeAlias = Annotated[WorkspaceClient, Depends(_get_user_ws)]
AgentDependency: TypeAlias = Annotated[Any, Depends(_get_agent)]
