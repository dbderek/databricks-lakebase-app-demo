# CLAUDE.md

Instructions for Claude when working on the Databricks Residential Investment Copilot demo project.

---

## Project Overview

**Databricks Residential Investment Copilot** -- an end-to-end demo showing the full Databricks platform story:

1. **Unity Catalog + SDP SQL Pipeline** ingests raw JSON from a UC Volume through bronze/silver/gold layers.
2. **Lakebase Autoscale** provides a PostgreSQL-compatible operational database for low-latency app queries.
3. **apx React + FastAPI App** delivers a full-stack Databricks App with portfolio analytics and deal underwriting.
4. **GenAI Investment Copilot Agent** answers investment questions and runs forecast scenarios via Model Serving.

- **Target workspace profile:** `vm` (fevm-startups.cloud.databricks.com)
- **Catalog:** `startups_catalog`
- **Lakebase project:** `db-residential-app-db`

---

## Key Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Lakebase tier | **Autoscale** (not provisioned) | Simpler for demos, auto-manages capacity |
| Pipeline language | **SQL** (not Python) | SDP SQL is declarative, concise, and maps directly to DLT |
| App framework | **apx toolkit** | Full-stack React + FastAPI with DI, OpenAPI codegen, and Databricks Apps integration |
| Deployment | **DABs (Databricks Asset Bundles)** | Infrastructure-as-code for pipelines, jobs, and the app |
| Bundle layout | **Single root bundle** | All resources (pipeline, jobs, app, database instance) managed by root `databricks.yml` |

---

## Project Structure

```
databricks.yml                  # DABs bundle (all resources: pipeline, jobs, app, DB instance)
resources/
  pipeline.yml                  # SDP pipeline resource definition
  sync_job.yml                  # Lakebase sync job resource
  deploy_agent_job.yml          # Agent deployment job resource
  app.yml                       # Databricks App + Lakebase database instance resources
src/
  app/                          # apx full-stack app
    app.yml                     # Databricks App process definition (command + env vars)
    pyproject.toml              # Python deps (uv) + apx config
    src/db_residential_copilot/
      backend/                  # FastAPI + Pydantic
        app.py                  # FastAPI entrypoint
        router.py               # API routes with operation_id
        models.py               # Pydantic models (3-model pattern)
        core/                   # DI, config, Lakebase engine, factory
          lakebase.py           # SQLAlchemy/SQLModel Lakebase integration
          dependencies.py       # Dependency injection definitions
      ui/                       # React + TypeScript (created on first apx dev start)
  notebooks/                    # Databricks notebooks (.ipynb)
    01_generate_sample_data.ipynb
    02_setup_lakebase.ipynb
    03_sync_gold_to_lakebase.ipynb
    04_register_agent.ipynb
    cleanup.ipynb
  pipelines/                    # SDP SQL pipeline files
    db_residential_sdp/
      transformations/
        bronze_properties.sql
        bronze_rents.sql
        silver_properties.sql
        silver_rents.sql
        gold_portfolio_property_metrics.sql
        gold_portfolio_time_series.sql
  agent/                        # Investment copilot agent code
deploy.sh                       # Convenience deploy script (--all, --pipeline, --app, etc.)
PROJECTPLAN.md                  # Full project plan with architecture and walkthrough
```

---

## Required References -- READ BEFORE BUILDING

Every component in this demo maps to specific AI Dev Kit skill documentation. **Always read the relevant skill files before implementing or modifying a component.**

| Component | Read This BEFORE Building |
|---|---|
| apx App (structure, DI, patterns) | `.claude/skills/databricks-app-apx/SKILL.md`, `backend-patterns.md`, `frontend-patterns.md` |
| Lakebase Autoscale | `.claude/skills/databricks-lakebase-autoscale/SKILL.md`, `reverse-etl.md`, `connection-patterns.md`, `projects.md`, `computes.md` |
| SDP SQL Pipeline | `.claude/skills/databricks-spark-declarative-pipelines/SKILL.md`, `references/sql/1-syntax-basics.md`, `references/sql/2-ingestion.md`, `references/sql/5-performance.md` |
| DABs Bundle Config | `.claude/skills/databricks-bundles/SKILL.md`, `SDP_guidance.md` |
| Unity Catalog / Volumes | `.claude/skills/databricks-unity-catalog/SKILL.md`, `6-volumes.md` |
| Synthetic Data Generation | `.claude/skills/databricks-synthetic-data-gen/SKILL.md` |
| Model Serving / Agent | `.claude/skills/databricks-model-serving/SKILL.md`, `3-genai-agents.md`, `4-tools-integration.md`, `7-deployment.md`, `8-querying-endpoints.md` |
| Agent Design | `.claude/skills/databricks-agent-bricks/SKILL.md`, `1-knowledge-assistants.md` |
| Jobs | `.claude/skills/databricks-jobs/SKILL.md`, `examples.md` |
| AI Functions (forecast) | `.claude/skills/databricks-ai-functions/SKILL.md`, `3-ai-forecast.md` |

---

## Commands

### Local Development (apx)

```bash
apx dev start              # Start backend + frontend + OpenAPI watcher
apx dev stop               # Stop all dev servers
apx dev check              # TypeScript + Python type checks
apx dev refresh_openapi    # Regenerate TypeScript API client from OpenAPI
```

### Bundle (all resources)

```bash
databricks bundle validate -p vm                         # Validate bundle
databricks bundle deploy -p vm                           # Deploy all resources
databricks bundle run db_residential_sdp -p vm           # Run the SDP pipeline
databricks bundle run lakebase_sync -p vm                # Run the Lakebase sync job
databricks bundle run deploy_agent -p vm                 # Deploy the agent
databricks bundle run db_residential_copilot_app -p vm   # Start the app
```

### Full Deployment

```bash
./deploy.sh --all              # Deploy everything in order
./deploy.sh --pipeline --app   # Deploy specific components
```

---

## Conventions

### General

- Notebooks use `.ipynb` format.
- The workspace profile is always `vm` (use `-p vm` with CLI commands).
- Python dependencies are managed via `uv` (never pip).
- Frontend dependencies are managed via `apx bun add <dep>`.

### MCP Server

- **Read-only only.** The Databricks MCP server is used exclusively for read-only validation and debugging (e.g., checking table schemas, previewing query results, verifying deployed resources).
- **NEVER** use MCP to create or modify persistent assets (tables, catalogs, schemas, jobs, pipelines, dashboards, etc.).
- All persistent assets must be created via DABs (`databricks bundle deploy`), the Databricks CLI, or notebooks -- so the demo is fully reproducible and transferable.

### SDP Pipeline (SQL)

- Pipeline SQL uses fully qualified table names (multi-schema pattern).
- Bronze tables live in `startups_catalog.bronze`.
- Silver tables live in `startups_catalog.silver`.
- Gold tables live in `startups_catalog.gold`.
- Schemas: `raw` (UC Volume), `bronze`, `silver`, `gold`.

### Backend (FastAPI)

- Follow the apx 3-model pattern: `Entity` (SQLModel table), `EntityIn` (request), `EntityOut` (response).
- All routes **must** have both `response_model` and `operation_id` (required for TypeScript codegen).
- Use `Dependencies.Client` for WorkspaceClient access (never construct manually).
- Use `Dependencies.Session` (from lakebase addon) for database access (never raw psycopg2).
- SSE streaming endpoints (chat) return `StreamingResponse` with `media_type="text/event-stream"`.

### Frontend (React + TypeScript)

- Use `useXSuspense` hooks with `Suspense` + `ErrorBoundary` and `Skeleton` fallbacks.
- SSE chat uses manual `fetch()` + `ReadableStream` (not generated hooks).
- Never manually edit `lib/api.ts` -- it is auto-generated by Orval from the OpenAPI schema.
- Add shadcn/ui components via `apx components add <name>`.

### Lakebase

- The app connects to Lakebase via SQLAlchemy/SQLModel (managed by `core/lakebase.py`).
- Production auth uses Databricks credential callback (automatic token rotation).
- Local dev uses `APX_DEV_DB_PORT` and `APX_DEV_DB_PWD` environment variables.
