
# Databricks Residential Investment Copilot – End-to-End Plan

End-to-end demo that shows Databricks as the governed **lakehouse backend**, **Lakebase** as the operational store the app talks to, and an **apx-powered React/TypeScript + FastAPI** app hosted as a **Databricks App**, with a small **agentic investment copilot**.

---

## 1. Objectives and Storyline

**Audience:** Databricks Residential engineering + investment teams building a Next.js/React analytics and model-routing platform.

**What you’ll show:**

- **Databricks as source of truth**  
  All portfolio and property data lives in Unity Catalog, curated via a bronze–silver–gold pipeline.
- **SDP-like curation pipeline**  
  Lakeflow/Delta Live Tables pipeline with Auto Loader from a UC Volume, feeding bronze → silver → gold tables.
- **Lakebase as the app-facing DB**  
  Curated gold data is synced into a Lakebase database; the app reads/writes via PostgreSQL.
- **Modern full-stack app (apx)**  
  React/TypeScript frontend + FastAPI backend built with the apx toolkit, talking to Lakebase and Databricks model/agent endpoints.
- **GenAI “Investment Copilot”**  
  Agentic workflow that answers questions and can run a 5‑year cash-flow forecast scenario.
- **Native Databricks Apps hosting**  
  The entire app (frontend + backend) hosted on Databricks Apps to consolidate infra.

---

## 2. High-Level Architecture

**Data & Governance**

- **Unity Catalog catalog:** `db_residential_demo`
- **Schemas:** `bronze`, `silver`, `gold`
- **UC Volume for raw:** `db_residential_demo.raw.data`
  - `/Volumes/db_residential_demo/raw/data/properties/*.json`
  - `/Volumes/db_residential_demo/raw/data/rents/*.json`

**Pipelines (SDP-style)**

- **Bronze:** Auto Loader from UC Volume → raw JSON into `bronze` tables.
- **Silver:** Type casting, dedupe, basic quality checks.
- **Gold:** Curated metrics for portfolio and properties (occupancy, avg rent, simple returns).

**Lakebase**

- **Database instance:** `db_residential_app_db` (Lakebase Postgres)
- **Schemas:** `app`
- **Tables (examples):**
  - `app.portfolio_metrics` – denormalized metrics for portfolio overview.
  - `app.deal_scenarios` – per-deal scenario inputs/outputs.
  - `app.chat_audit` – optional logging of copilot questions/answers.

**Application Layer (Databricks App via apx)**

- **Toolkit:** [apx](https://databricks-solutions.github.io/apx/) — full-stack Databricks Apps framework (React + FastAPI).
- **Backend:** FastAPI + Pydantic, with apx dependency injection (`Dependencies.Client`, `Dependencies.Session`).
  - Reads/writes Lakebase via SQLModel (lakebase addon).
  - Calls Databricks model/agent serving endpoint(s) via `WorkspaceClient`.
- **Frontend:** React + TypeScript + Vite + bun
  - Routing: `@tanstack/react-router` (file-based)
  - Data fetching: `@tanstack/react-query` via auto-generated hooks (Orval from OpenAPI)
  - Components: shadcn/ui
  - Pages: **Portfolio Overview**, **Deal Underwriting**, **Investment Copilot (chat)**.
- **Deployment:** `apx build` → Databricks App via `databricks.yml` (Databricks Asset Bundles).

**GenAI / Agents**

- Mosaic AI / model serving endpoint with:
  - Tools to query (Lakehouse or Lakebase) and run a forecast function.
  - Used by `/api/chat` endpoint for the copilot.

---

## 3. Data & Governance Setup (Unity Catalog + Volumes)

1. **Create catalog & schemas**

   - `CREATE CATALOG db_residential_demo;`
   - `CREATE SCHEMA db_residential_demo.bronze;`
   - `CREATE SCHEMA db_residential_demo.silver;`
   - `CREATE SCHEMA db_residential_demo.gold;`

2. **Create UC Volume for raw JSON**

   - `CREATE VOLUME db_residential_demo.raw COMMENT 'Raw JSON for Databricks Residential demo';`
   - Upload JSON files into:
     - `Volumes/db_residential_demo/raw/data/properties/`
     - `Volumes/db_residential_demo/raw/data/rents/`

3. **Permissions**

   - Grant appropriate read/write to:
     - Your user
     - Databricks App service principal (later)
     - Model/agent services as needed.

---

## 4. SDP-Style Lakeflow / DLT Pipeline (Bronze → Silver → Gold)

**Goal:** Mimic a simple SDP pipeline that auto-loads JSON from a UC Volume and curates it into gold metrics.

### 4.1. Bronze – Auto Loader from UC Volume

- Notebook: `pipelines/db_residential_sdp_pipeline.py`
- Use `cloudFiles` with `format=json` and schemaLocation under the Volume.

Bronze tables (streaming or batch):

- `db_residential_demo.bronze.properties_bronze`
- `db_residential_demo.bronze.rents_bronze`

### 4.2. Silver – Cleaning & Typing

Silver tables:

- `db_residential_demo.silver.properties_silver`
  - Casts types, dedupes by `property_id`.
- `db_residential_demo.silver.rents_silver`
  - Types rents, dates, occupancy flag; adds simple surrogate key.

### 4.3. Gold – Curated Metrics

Gold tables:

- `db_residential_demo.gold.portfolio_property_metrics`
  - Per property:
    - `avg_rent`
    - `occupancy_rate`
    - `units`, `purchase_price`, `acquisition_date`
- Optional:
  - `db_residential_demo.gold.portfolio_time_series` – daily/weekly AUM & cash yield.

### 4.4. Pipeline Configuration

- **Pipeline name:** `db_residential_investments_sdp`
- **Target catalog:** `db_residential_demo`
- **Storage location:** UC-backed path (e.g. `/Volumes/db_residential_demo/raw/dlt_storage`).
- **Triggers:**
  - Manual for the demo, or scheduled (e.g., hourly).

---

## 5. Lakebase Component

**Goal:** The app uses Lakebase (PostgreSQL) as its primary data store, while the lakehouse + DLT remain the curated source of truth.

### 5.1. Create Lakebase Database

1. In the UI, create a Lakebase Postgres instance:

   - Name: `db_residential_app_db`
   - Size: small (demo).
   - Enable UC integration if available (for governance / lineage).

2. Configure network & authentication:
   - Use workspace-managed auth where possible.
   - Capture the **JDBC / connection URI** for the app.

### 5.2. Define App Schema & Tables

In `db_residential_app_db`, create an `app` schema:

- `app.portfolio_metrics`
  - Mirrors `gold.portfolio_property_metrics`, but optimized for app queries.
- `app.deal_scenarios`
  - Holds per-deal input assumptions and computed outputs (IRR, DSCR, etc.).
- (Optional) `app.chat_audit`
  - `id`, `user_id`, `timestamp`, `question`, `answer_summary`.

### 5.3. Sync Strategy (Lakehouse → Lakebase)

Pick a simple path for the demo:

- **Option A (if Lakehouse Sync to Lakebase is available in your workspace):**
  - Configure Lakehouse Sync job from `gold.portfolio_property_metrics` to `db_residential_app_db.app.portfolio_metrics`.

- **Option B (portable job-based sync):**
  - Create a Databricks Job with a notebook:
    - Reads `db_residential_demo.gold.portfolio_property_metrics`.
    - Connects to `db_residential_app_db` using a PostgreSQL driver (e.g., `psycopg2` or `pg8000`).
    - Upserts rows into `app.portfolio_metrics` (truncate+insert is fine for demo scale).
  - Schedule it to run after the DLT pipeline or keep it manual for demo.

### 5.4. App R/W Patterns

- **Reads:**
  - All app dashboards and most REST endpoints execute `SELECT` queries against Lakebase tables (`app.portfolio_metrics`, `app.deal_scenarios`).
- **Writes:**
  - User-entered scenario assumptions and results are stored in `app.deal_scenarios`.
  - Optional: chat questions / summaries logged into `app.chat_audit`.

This shows **Lakehouse for analytics + governance** and **Lakebase for app-facing OLTP-ish workloads**.

---

## 6. FastAPI Backend Design (apx)

**Folder:** `src/<app>/backend/`

### 6.1. Project Layout

```
src/<app>/backend/
├── app.py             # FastAPI entrypoint: app = create_app(routers=[router], lifespan=...)
├── router.py          # API routes with operation_id
├── models.py          # Pydantic models (3-model pattern: Entity, EntityIn, EntityOut)
└── core.py            # Dependencies class, AppConfig, create_router, create_app
```

### 6.2. Responsibilities

- Expose REST API used by React frontend (auto-generates OpenAPI → TypeScript hooks).
- Read/write data in Lakebase via SQLModel (`Dependencies.Session` from lakebase addon).
- Call Databricks model/agent endpoints via `Dependencies.Client` (`WorkspaceClient`).
- Run inside Databricks Apps (apx handles the entrypoint).

### 6.3. Key Endpoints

All routes use `response_model` and `operation_id` for correct TypeScript client generation.

- `GET /api/portfolio/overview` — `operation_id="listPortfolioMetrics"`
  - Query: `session.exec(select(PortfolioMetric)).all()`
  - Returns summary metrics for portfolio overview page.
  - Frontend hook: `useListPortfolioMetricsSuspense()`

- `GET /api/properties/{property_id}` — `operation_id="getProperty"`
  - Query property + aggregated rent data for detail view.
  - Frontend hook: `useGetPropertySuspense()`

- `POST /api/deals/{deal_id}/forecast` — `operation_id="createDealForecast"`
  - Request body (`DealScenarioIn`): scenario assumptions (LTV, rent growth, expense ratio, exit cap, horizon, etc.).
  - Logic:
    1. Store scenario inputs in `app.deal_scenarios` via `Dependencies.Session`.
    2. Call Databricks model/forecast via `Dependencies.Client`:
       `ws.serving_endpoints.query("investment_copilot", ...)`.
    3. Store forecast outputs back into `app.deal_scenarios`.
    4. Return `DealScenarioOut` summary metrics to frontend.
  - Frontend hook: `useCreateDealForecast()`

- `POST /api/chat` — `operation_id="chat"` (SSE streaming)
  - Returns `StreamingResponse` with `media_type="text/event-stream"`.
  - Calls Mosaic AI / model-serving endpoint (agent) with user question + optional deal/portfolio context.
  - Streams answer text as SSE events; sends `data: [DONE]\n\n` on completion.
  - Frontend uses manual `fetch()` + `ReadableStream` (generated hooks don't support SSE).
  - Optionally logs the Q/A into `app.chat_audit`.

### 6.4. Databricks Integration

- **Always use `Dependencies.Client`** (injected `WorkspaceClient`) — never construct manually or use raw `requests`.
- **Lakebase access** via `Dependencies.Session` (SQLModel, from lakebase addon) — not raw `psycopg2`.
- Configuration via `AppConfig` in `core.py`, populated from environment variables with app-slug prefix.

---

## 7. React/TypeScript Frontend (apx)

**Folder:** `src/<app>/ui/`

### 7.1. Project Layout

```
src/<app>/ui/
├── components/        # UI components (shadcn/ui)
│   └── ui/            # Installed shadcn base components
├── routes/            # @tanstack/react-router file-based pages
├── lib/
│   ├── api.ts         # Auto-generated API client (Orval) — DO NOT edit manually
│   └── selector.ts    # Default query selector
└── styles/            # CSS styles
```

### 7.2. Pages / Views

All pages use `useXSuspense` hooks wrapped in `Suspense` + `ErrorBoundary` with `Skeleton` fallbacks.

1. **Portfolio Overview** (`routes/index.tsx` or `routes/portfolio.tsx`)
   - Uses `useListPortfolioMetricsSuspense(selector())`.
   - Shows:
     - List of properties with key metrics.
     - Aggregate KPIs (overall occupancy, AUM, cash yield).

2. **Deal Underwriting** (`routes/deals.$dealId.tsx`)
   - Form for scenario assumptions (purchase price, LTV, growth, etc.).
   - On submit:
     - Uses `useCreateDealForecast()` mutation with cache invalidation.
     - Render returned IRR/DSCR and a small cash-flow chart.

3. **Investment Copilot (Chat Panel)** (sidebar or `routes/copilot.tsx`)
   - Chat-style UI using custom `useChat()` hook with manual `fetch()` + SSE `ReadableStream`.
   - Check `@ai-elements` registry for chat UI components before building custom ones.
   - Displays markdown-formatted output.
   - Option to “Apply scenario” if the agent proposes one (optional for v1).

### 7.3. API Client

- **Auto-generated** from OpenAPI schema via Orval — regenerates automatically when dev servers are running.
- Run `apx dev refresh_openapi` (or MCP `refresh_openapi`) after adding/modifying backend routes.
- Never manually call `fetch()` or `axios` — use generated hooks. **Exception:** SSE streaming endpoints (chat).

### 7.4. Build Output

- `apx build` produces production assets.
- FastAPI serves the built frontend at `/` and the API at `/api`.

---

## 8. GenAI / Agentic Workflow

**Goal:** Show an “investment copilot” that uses the same governed data.

### 8.1. Agent Design

- Base LLM: Databricks-supported foundation model (e.g., DBRX or Claude via model serving).
- Tools:
  - **Portfolio tool:** SQL query against Lakehouse or Lakebase for exposures, performance, etc.
  - **Forecast tool:** Calls the same endpoint/notebook used by `/api/deals/{deal_id}/forecast`.
- Behaviors:
  - Answer questions like:
    - “Where are we over-exposed by geography or asset type?”
    - “How does this new Denver deal affect cash flow over the next 5 years?”

### 8.2. Serving Endpoint

- Register agent as a model/endpoint:
  - Name: `investment_copilot`.
  - Accessible by the Databricks App’s service principal.
- FastAPI `/api/chat` simply forwards requests and returns responses.

---

## 9. Databricks App Packaging & Deployment (apx)

**Folder layout:**

```text
/db-residential-investment-copilot/
  src/<app>/
    ui/                  # React + Vite frontend
    backend/             # FastAPI backend
  databricks.yml         # Databricks Asset Bundle config
  pyproject.toml         # Python deps (uv) + apx config
  app.yaml               # Databricks App process definition
```

### 9.1. Project Initialization

```bash
apx init                                    # scaffold new project
apx dev apply lakebase                      # add Lakebase addon (SQLModel + Dependencies.Session)
```

### 9.2. Python Dependencies (`pyproject.toml` / uv)

Managed via `uv` (never pip). Key dependencies provided by apx:

- `fastapi`, `uvicorn`
- `databricks-sdk`
- `pydantic`, `sqlmodel` (via lakebase addon)
- Additional: model-serving client libs as needed.

### 9.3. Frontend Dependencies (bun)

Managed via `apx bun add <dep>`. Provided by apx scaffold:

- `react`, `react-dom`
- `vite`, `@tanstack/react-router`, `@tanstack/react-query`
- `typescript` + types
- shadcn/ui components added via `apx components add <name>`

### 9.4. Dev Workflow

```bash
apx dev start            # Start backend + frontend + OpenAPI watcher
apx dev check            # TypeScript + Python type checks
apx dev logs -f          # Stream logs
apx dev stop             # Stop all dev servers
```

After modifying backend routes, the OpenAPI client auto-regenerates (or run `apx dev refresh_openapi`).

### 9.5. Deployment Steps

1. Build:
   - `apx build` (produces production frontend assets + backend bundle).
2. Deploy via Databricks Asset Bundles:
   - `databricks bundle deploy`
3. Test:
   - Visit the Databricks App URL.
   - Verify:
     - Portfolio Overview loads from Lakebase.
     - Deal Underwriting POST works.
     - Chat copilot responds.

---

## 10. Demo Walkthrough Script (External-Facing)

1. **Set the scene**
   - “Databricks Residential wants Databricks as the governed backend, without rewriting their React/Next app.”

2. **Show UC + pipeline**
   - Open Unity Catalog:
     - Show `db_residential_demo` catalog; highlight tables in bronze/silver/gold.
     - Briefly open lineage from a gold table back to raw Volume → DLT pipeline.
   - Explain the SDP-style pipeline:
     - JSON in UC Volume → Auto Loader → bronze/silver/gold.

3. **Show Lakebase**
   - Open `db_residential_app_db`:
     - Show `app.portfolio_metrics`.
   - Explain:
     - “The app talks PostgreSQL to Lakebase. Lakehouse remains the curated source; we sync into Lakebase for low-latency app queries.”

4. **Open the Databricks App**
   - Portfolio Overview:
     - Show metrics, filter to a property; mention these are coming from Lakebase.
   - Deal Underwriting:
     - Enter assumptions, run forecast.
     - Show computed IRR/DSCR; mention the call path back to Databricks model/logic.
   - Investment Copilot:
     - Ask an investment question; show answer referencing metrics and/or running a scenario.

5. **Close with architecture**
   - Flip to a summary slide / notebook cell:
     - UC + DLT (Lakehouse) → Lakebase → Databricks App + Agents.
   - Emphasize:
     - They can keep their **React/TS + API** pattern.
     - Databricks becomes the **single governed data+AI plane** behind it.
