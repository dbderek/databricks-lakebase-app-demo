# Architecture -- Databricks Residential Investment Copilot

---

## End-to-End Architecture Diagram

```
+=====================================================================================+
|                           ROOT DABS BUNDLE (databricks.yml)                         |
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
|  |   - deploy_agent  (notebook 04)                              |   |               |
|  +--------------------------------------------------------------+   |               |
|                                                                     |               |
+=====================================================================================+
                                                                      |
                              Lakehouse Sync (Gold --> Lakebase)      |
                                                                      v
+=====================================================================================+
|                         APX APP BUNDLE (src/app/databricks.yml)                     |
|                                                                                     |
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
|                                                  |  +---+--------------------+  |   |
|                                                  |      |          ^            |   |
|                                                  |      | serves   | API calls  |   |
|                                                  |      v          |            |   |
|                                                  |  +---+--------------------+  |   |
|                                                  |  |  React Frontend        |  |   |
|                                                  |  |                        |  |   |
|                                                  |  |  Portfolio Overview    |  |   |
|                                                  |  |  Deal Underwriting    |  |   |
|                                                  |  |  Investment Copilot   |  |   |
|                                                  |  |  (Chat Panel)         |  |   |
|                                                  |  +------------------------+  |   |
|                                                  +------------------------------+   |
|                                                                                     |
+=====================================================================================+
                                                       |
                                                       | /api/chat calls
                                                       v
                                          +---------------------------+
                                          |  Model Serving Endpoint   |
                                          |  "investment_copilot"     |
                                          |                           |
                                          |  Tools:                   |
                                          |   - Portfolio query       |
                                          |     (SQL against          |
                                          |      Lakehouse/Lakebase)  |
                                          |   - Forecast tool         |
                                          |     (5-year cash flow)    |
                                          +---------------------------+
                                                       |
                                                       | reads governed data
                                                       v
                                          +---------------------------+
                                          |  Unity Catalog            |
                                          |  db_residential_demo      |
                                          |  (gold tables / Lakebase) |
                                          +---------------------------+


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

- **Location:** `db_residential_demo.raw.data`
- **Paths:**
  - `/Volumes/db_residential_demo/raw/data/properties/*.json` -- property records (address, units, purchase price, acquisition date)
  - `/Volumes/db_residential_demo/raw/data/rents/*.json` -- rent records (monthly rent, occupancy, dates)
- **Role:** Landing zone for raw JSON data. The synthetic data generation notebook (`01_generate_sample_data.ipynb`) populates this volume.

### 2. SDP SQL Pipeline (Bronze / Silver / Gold)

- **Pipeline name:** `db_residential_sdp`
- **Engine:** Serverless + Photon
- **DABs resource:** `resources/pipeline.yml`

#### Bronze Layer (`db_residential_demo.bronze`)

- `bronze_properties` -- Auto Loader streaming table from properties JSON
- `bronze_rents` -- Auto Loader streaming table from rents JSON
- Ingests raw JSON with schema inference; preserves all source fields.

#### Silver Layer (`db_residential_demo.silver`)

- `silver_properties` -- Type-cast, deduped by `property_id`
- `silver_rents` -- Type-cast, date-normalized, occupancy flag added
- Applies data quality checks and cleaning transformations.

#### Gold Layer (`db_residential_demo.gold`)

- `gold_portfolio_property_metrics` -- Per-property aggregated metrics (avg rent, occupancy rate, units, purchase price, acquisition date)
- `gold_portfolio_time_series` -- Time-series view of portfolio performance (AUM, cash yield over time)
- These are materialized views that join and aggregate silver data into app-ready metrics.

### 3. Lakebase Autoscale (Operational Database)

- **Instance:** `db-residential-copilot` (PostgreSQL-compatible)
- **Capacity:** CU_1 (auto-scaling)
- **Database:** `databricks_postgres`
- **DABs resource:** Defined in `src/app/databricks.yml`

#### App Schema Tables

- `app.portfolio_metrics` -- Mirrors gold portfolio metrics, optimized for app queries
- `app.deal_scenarios` -- Stores deal input assumptions and computed outputs (IRR, DSCR, etc.)
- `app.chat_audit` -- Logs copilot questions and answer summaries

#### Sync Mechanism

The `lakebase_sync` job (`resources/sync_job.yml`) runs notebook `03_sync_gold_to_lakebase.ipynb` to sync gold tables from the Lakehouse into Lakebase. This keeps the operational database current with the curated analytics layer.

### 4. apx Full-Stack App (Databricks App)

- **App name:** `db-residential-copilot`
- **Framework:** apx (React + TypeScript frontend, FastAPI + Pydantic backend)
- **DABs resource:** `src/app/databricks.yml`

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

### 5. Model Serving Endpoint (Investment Copilot Agent)

- **Endpoint name:** `investment_copilot`
- **Deployed by:** `deploy_agent` job (`resources/deploy_agent_job.yml`) running notebook `04_register_agent.ipynb`
- **Agent code:** `src/agent/`

#### Agent Tools

- **Portfolio query tool** -- Executes SQL against Lakehouse or Lakebase tables to answer exposure, performance, and allocation questions
- **Forecast tool** -- Runs 5-year cash-flow projections with configurable assumptions (LTV, rent growth, expense ratio, exit cap rate)

#### Integration

The FastAPI `/api/chat` endpoint forwards user messages to the Model Serving endpoint and streams back responses as SSE events. The agent has access to the same governed data in Unity Catalog, completing the loop from raw data through analytics to AI-powered insights.

---

## Data Flow Summary

1. **Ingest:** Raw JSON files land in the UC Volume (`db_residential_demo.raw.data`).
2. **Transform:** The SDP SQL pipeline processes data through bronze (raw ingestion), silver (cleaned/typed), and gold (aggregated metrics) layers.
3. **Sync:** The Lakebase sync job copies gold tables into the Lakebase PostgreSQL database for low-latency app access.
4. **Serve:** The apx app reads from Lakebase via SQLModel and writes user-generated scenarios back.
5. **AI:** The investment copilot agent queries governed data and runs forecasts, accessible through the app's chat interface.
6. **Present:** The React frontend displays portfolio analytics, deal underwriting tools, and the copilot chat to the end user.

---

## Bundle Scopes

### Root Bundle (`databricks.yml`)

Manages the data infrastructure:

- SDP SQL Pipeline (`db_residential_sdp`)
- Lakebase sync job (`lakebase_sync`)
- Agent deployment job (`deploy_agent`)
- Variables: catalog name, schema names, warehouse ID

### App Bundle (`src/app/databricks.yml`)

Manages the application infrastructure:

- Lakebase Autoscale database instance (`db-residential-copilot`)
- Databricks App resource (`db-residential-copilot`)
- Build artifact via `apx build`
