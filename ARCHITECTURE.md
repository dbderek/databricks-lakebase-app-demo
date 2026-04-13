# Architecture -- Databricks Residential Investment Copilot

---

## End-to-End Architecture Diagram

```
+=====================================================================================+
|                         DABS BUNDLE (databricks.yml)                                |
|                                                                                     |
|  +------------------+     +---------------------------------------------------+     |
|  |   UC Volume      |     |        SDP SQL Pipeline (Serverless + Photon)     |     |
|  |   (Raw JSON)     |     |                                                   |     |
|  |                  |     |   +----------+    +-----------+    +----------+   |     |
|  |  /Volumes/       |---->|   |  BRONZE  |--->|  SILVER   |--->|   GOLD   |   |     |
|  |  db_residential_ |     |   |          |    |           |    |          |   |     |
|  |  demo/raw/data/  |     |   | Auto     |    | Type cast |    | Agg      |   |     |
|  |                  |     |   | Loader   |    | Dedupe    |    | metrics  |   |     |
|  |  properties/     |     |   | Stream   |    | Quality   |    | Joins    |   |     |
|  |    *.json        |     |   | Tables   |    | Checks    |    | Mat.Views|   |     |
|  |  rents/          |     |   +----------+    +-----------+    +----+-----+   |     |
|  |    *.json        |     |                                         |         |     |
|  +------------------+     +-----------------------------------------|---------+     |
|                                                                     |               |
|  +--------------------------------------------------------------+   |               |
|  |  Jobs                                                        |   |               |
|  |   - lakebase_sync (notebook 03)  <---------------------------+   |               |
|  +--------------------------------------------------------------+   |               |
|                                                                     |               |
|  +------------------------------------------+    +------------------------------+   |
|  |  Lakebase Autoscale (PostgreSQL)         |    |  Databricks App              |   |
|  |  Instance: db-residential-copilot        |    |  Name: db-residential-copilot|   |
|  |  Capacity: CU_1                          |    |                              |   |
|  |                                          |    |  +------------------------+  |   |
|  |  Schema: app                             |    |  |  FastAPI Backend       |  |   |
|  |   - portfolio_metrics                    |<===|  |                        |  |   |
|  |   - deal_scenarios                       |    |  |  GET  /api/portfolio   |  |   |
|  |   - chat_audit                           |    |  |  GET  /api/properties  |  |   |
|  |                                          |    |  |  POST /api/deals       |  |   |
|  +------------------------------------------+    |  |  POST /api/chat (SSE)  |  |   |
|                                                  |  |                        |  |   |
|                                                  |  |  In-Process Agent:     |  |   |
|                                                  |  |   LangGraph ReAct      |  |   |
|                                                  |  |   + ChatDatabricks  -----------> Foundation Model APIs
|                                                  |  |   + portfolio_query    |  |   |  (Claude, GPT-5, Gemini)
|                                                  |  |   + deal_forecast      |  |   |
|                                                  |  +---+--------------------+  |   |
|                                                  |      |          ^            |   |
|                                                  |      | serves   | API calls  |   |
|                                                  |      v          |            |   |
|                                                  |  +---+--------------------+  |   |
|                                                  |  |  React Frontend        |  |   |
|                                                  |  |                        |  |   |
|                                                  |  |  Landing Page          |  |   |
|                                                  |  |  Portfolio Dashboard   |  |   |
|                                                  |  |  Deal Underwriting     |  |   |
|                                                  |  |  Investment Copilot    |  |   |
|                                                  |  +------------------------+  |   |
|                                                  +------------------------------+   |
|                                                                                     |
+=====================================================================================+


Data Flow (simplified):

  JSON Files --> UC Volume --> SDP Pipeline --> Bronze --> Silver --> Gold
                                                                      |
                                                           Sync Job --+
                                                                      |
                                                                      v
                                                              Lakebase (app schema)
                                                                      |
                                                       +--------------+--------------+
                                                       |                             |
                                                       v                             v
                                                  FastAPI Backend             Model Serving
                                                       |                      (Agent Tools)
                                                       v
                                                  React Frontend
                                                       |
                                                       v
                                                     User
```

---

## Component Descriptions

### 1. Unity Catalog Volume (Raw Data)

- **Location:** `startups_catalog.raw.data`
- **Paths:**
  - `/Volumes/startups_catalog/raw/data/properties/*.json` -- property records (address, units, purchase price, acquisition date)
  - `/Volumes/startups_catalog/raw/data/rents/*.json` -- rent records (monthly rent, occupancy, dates)
- **Role:** Landing zone for raw JSON data. The synthetic data generation notebook (`01_generate_sample_data.ipynb`) populates this volume.

### 2. SDP SQL Pipeline (Bronze / Silver / Gold)

- **Pipeline name:** `db_residential_sdp`
- **Engine:** Serverless + Photon
- **DABs resource:** `resources/pipeline.yml`

#### Bronze Layer (`startups_catalog.bronze`)

- `bronze_properties` -- Auto Loader streaming table from properties JSON
- `bronze_rents` -- Auto Loader streaming table from rents JSON
- Ingests raw JSON with schema inference; preserves all source fields.

#### Silver Layer (`startups_catalog.silver`)

- `silver_properties` -- Type-cast, deduped by `property_id`
- `silver_rents` -- Type-cast, date-normalized, occupancy flag added
- Applies data quality checks and cleaning transformations.

#### Gold Layer (`startups_catalog.gold`)

- `gold_portfolio_property_metrics` -- Per-property aggregated metrics (avg rent, occupancy rate, units, purchase price, acquisition date)
- `gold_portfolio_time_series` -- Time-series view of portfolio performance (AUM, cash yield over time)
- These are materialized views that join and aggregate silver data into app-ready metrics.

### 3. Lakebase Autoscale (Operational Database)

- **Instance:** `db-residential-copilot` (PostgreSQL-compatible)
- **Capacity:** CU_1 (auto-scaling)
- **Database:** `databricks_postgres`
- **DABs resource:** Defined in `resources/app.yml`

#### App Schema Tables

- `app.portfolio_metrics` -- Mirrors gold portfolio metrics, optimized for app queries
- `app.deal_scenarios` -- Stores deal input assumptions and computed outputs (IRR, DSCR, etc.)
- `app.chat_audit` -- Logs copilot questions and answer summaries

#### Sync Mechanism

The `lakebase_sync` job (`resources/sync_job.yml`) runs notebook `03_sync_gold_to_lakebase.ipynb` to sync gold tables from the Lakehouse into Lakebase. This keeps the operational database current with the curated analytics layer.

### 4. apx Full-Stack App (Databricks App)

- **App name:** `db-residential-copilot`
- **Framework:** apx (React + TypeScript frontend, FastAPI + Pydantic backend)
- **DABs resource:** `resources/app.yml`

#### FastAPI Backend

- **Entrypoint:** `src/app/src/db_residential_copilot/backend/app.py`
- **Routes:** `router.py` with `response_model` and `operation_id` on every endpoint
- **Database access:** SQLAlchemy/SQLModel via `Dependencies.Session` (lakebase addon)
- **Workspace access:** `Dependencies.Client` (injected `WorkspaceClient`)
- **Key endpoints:**
  - `GET /api/portfolio/overview` -- Portfolio metrics from Lakebase
  - `GET /api/properties/{property_id}` -- Property detail
  - `POST /api/deals/{deal_id}/forecast` -- Run forecast scenario
  - `POST /api/chat` -- SSE streaming copilot chat

#### React Frontend

- **Stack:** React, TypeScript, Vite, TanStack Router (file-based), TanStack React Query, shadcn/ui
- **API client:** Auto-generated via Orval from the backend OpenAPI schema
- **Pages:**
  - Portfolio Overview -- property list with KPIs
  - Deal Underwriting -- scenario form with IRR/DSCR output
  - Investment Copilot -- chat panel with SSE streaming

### 5. Investment Copilot Agent (In-Process)

- **Location:** `src/app/src/db_residential_copilot/backend/agent.py`
- **Framework:** LangGraph ReAct agent running in-process within the FastAPI backend
- **LLM:** ChatDatabricks (foundation model endpoints) -- user-selectable from Claude, GPT-5, and Gemini models
- **Database access:** Queries Lakebase directly via the shared SQLAlchemy engine

#### Agent Tools

- **portfolio_query** -- Executes read-only SQL against Lakebase (gold schema tables: `gold.portfolio_metrics`, `gold.portfolio_time_series`)
- **deal_forecast** -- Runs 5-year cash-flow projections with configurable assumptions (LTV, rent growth, expense ratio, exit cap rate)

#### Integration

The FastAPI `/api/chat` endpoint creates a LangGraph agent in-process, streams responses back to the frontend as SSE events. The agent queries Lakebase directly (same database connection as the app), avoiding the need for a separate serving endpoint. Agents are cached per-model so switching LLMs is instantaneous after first use.

---

## Data Flow Summary

1. **Ingest:** Raw JSON files land in the UC Volume (`startups_catalog.raw.data`).
2. **Transform:** The SDP SQL pipeline processes data through bronze (raw ingestion), silver (cleaned/typed), and gold (aggregated metrics) layers.
3. **Sync:** The Lakebase sync job copies gold tables into the Lakebase PostgreSQL database for low-latency app access.
4. **Serve:** The apx app reads from Lakebase via SQLModel and writes user-generated scenarios back.
5. **AI:** The in-process investment copilot agent queries Lakebase directly and runs forecasts via foundation model endpoints.
6. **Present:** The React frontend displays portfolio analytics, deal underwriting tools, and the copilot chat to the end user.

---

## Bundle Structure

### Single Bundle (`databricks.yml`)

All infrastructure is managed by a single root bundle:

- **Data:** SDP SQL Pipeline (`db_residential_sdp`)
- **Sync:** Lakebase sync job (`lakebase_sync`)
- **Database:** Lakebase Autoscale instance (`db-residential-copilot`) -- defined in `resources/app.yml`
- **App:** Databricks App (`db-residential-copilot`) -- defined in `resources/app.yml`, built via `apx build` artifact
- **Variables:** catalog name, schema names, warehouse ID
