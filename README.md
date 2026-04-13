# Databricks Residential Investment Copilot

End-to-end demo showing the full Databricks platform story: governed lakehouse, Lakebase operational database, full-stack Databricks App, and GenAI investment copilot — all deployed via Databricks Asset Bundles.

---

## Architecture

```
  JSON Files ──> UC Volume ──> SDP Pipeline ──> Bronze ──> Silver ──> Gold
                                                                       │
                                                            Sync Job ──┘
                                                                       │
                                                                       ▼
                                                               Lakebase (PostgreSQL)
                                                                       │
                                                        ┌──────────────┤
                                                        ▼              ▼
                                                   FastAPI        In-Process Agent
                                                   Backend        (LangGraph ReAct)
                                                        │              │
                                                        ▼              │
                                                   React Frontend <────┘
                                                        │
                                                        ▼
                                                      User
```

### Components

| Layer | What | Where |
|---|---|---|
| **Raw data** | ~50 properties, ~80K rent records (JSON) | UC Volume `startups_catalog.raw.data` |
| **SDP Pipeline** | Bronze → Silver → Gold (SQL, serverless + Photon) | `src/pipelines/db_residential_sdp/` |
| **Lakebase** | PostgreSQL-compatible operational DB (Autoscale) | Instance `db-residential-copilot` |
| **App** | React + FastAPI on Databricks Apps (apx toolkit) | `src/app/` |
| **Copilot** | LangGraph ReAct agent with portfolio query + forecast tools | `src/app/.../backend/agent.py` |
| **LLM** | ChatDatabricks foundation model endpoints (Claude, GPT-5, Gemini) | Databricks Model Serving |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full component breakdown.

---

## Prerequisites

- **Databricks CLI** (v0.250+) with a workspace profile configured
- **Python 3.11+** and **uv**
- **Node.js 20+** and **bun**
- **apx** (`pip install databricks-apx`)
- A Databricks workspace with:
  - Unity Catalog enabled
  - Serverless compute
  - Foundation Model API access (for copilot)
  - Lakebase Autoscale enabled

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/dbderek/databricks-lakebase-app-demo.git
cd databricks-lakebase-app-demo
```

Edit `databricks.yml` to set your target workspace profile and catalog name if different from `startups_catalog`.

### 2. Deploy everything

```bash
./deploy.sh --all
```

This runs the full deployment in order:

1. **Bundle deploy** — pushes all resources to the workspace
2. **Sample data** — generates ~50 properties and ~80K rent records into the UC Volume
3. **SDP pipeline** — runs bronze → silver → gold transformations
4. **Lakebase setup** — provisions the Lakebase project, creates app-writable tables, syncs gold data
5. **App deploy** — builds the React frontend, deploys the Databricks App

### 3. Selective deployment

```bash
./deploy.sh --pipeline --app          # Just pipeline + app
./deploy.sh --data                    # Re-generate sample data only
./deploy.sh --lakebase                # Re-sync Lakebase only
./deploy.sh --target prod --profile my-ws  # Different target/profile
```

---

## Project Structure

```
databricks.yml                  # DABs bundle root (all resources)
resources/
  pipeline.yml                  # SDP pipeline
  sync_job.yml                  # Lakebase sync job
  app.yml                       # Databricks App + Lakebase instance
  data_gen_job.yml              # Sample data generation job
  lakebase_setup_job.yml        # Lakebase provisioning job
src/
  app/                          # apx full-stack app
    app.yml                     # App process definition
    src/db_residential_copilot/
      backend/
        app.py                  # FastAPI entrypoint
        router.py               # API routes
        models.py               # Pydantic/SQLModel models
        agent.py                # LangGraph ReAct copilot agent
        core/                   # DI, config, Lakebase engine
      ui/
        routes/
          index.tsx             # Landing page
          portfolio.tsx         # Executive dashboard
          deals.tsx             # Deal underwriting
          copilot.tsx           # Investment copilot chat
        styles/globals.css      # Dark theme, Databricks branding
  notebooks/
    01_generate_sample_data.ipynb
    02_setup_lakebase.ipynb
    03_sync_gold_to_lakebase.ipynb
    cleanup.ipynb
  pipelines/
    db_residential_sdp/
      transformations/
        bronze_properties.sql
        bronze_rents.sql
        silver_properties.sql
        silver_rents.sql
        gold_portfolio_property_metrics.sql
        gold_portfolio_time_series.sql
deploy.sh                       # Convenience deploy script
```

---

## App Pages

### Landing Page
Interactive hero with 3D parallax orb, feature cards linking to portfolio, deals, and copilot.

### Portfolio Dashboard
Executive-style dashboard with KPI cards, AUM/rent trends, occupancy comparisons (Denver vs. others), property type distribution, and top markets — all powered by Recharts.

### Deal Underwriting
Scenario modeling form for potential acquisitions. Enter property details and financial assumptions, get back NOI, DSCR, IRR, equity multiple, and NPV. Deals are persisted to Lakebase.

### Investment Copilot
Chat interface backed by a LangGraph ReAct agent running in-process. The agent has two tools:
- **portfolio_query** — executes read-only SQL against Lakebase (gold schema tables)
- **deal_forecast** — runs 5-year cash-flow projections

Users can select from multiple foundation models (Claude Sonnet/Opus/Haiku, GPT-5/Mini/Nano, Gemini 2.5 Pro) via a dropdown.

---

## Local Development

```bash
cd src/app
apx dev start              # Start backend + frontend + OpenAPI watcher
apx dev check              # TypeScript + Python type checks
apx dev refresh_openapi    # Regenerate TypeScript API client
```

---

## Bundle Commands

```bash
databricks bundle validate -p vm
databricks bundle deploy -p vm
databricks bundle run db_residential_sdp -p vm           # Run pipeline
databricks bundle run lakebase_sync -p vm                # Sync to Lakebase
databricks bundle run db_residential_copilot_app -p vm   # Deploy/restart app
```

---

## Cleanup

1. Run `cleanup.ipynb` on the workspace to remove synced tables, Lakebase project, and schemas
2. Run `databricks bundle destroy -t dev -p vm` to remove DABs-managed resources (pipeline, jobs, app)

---

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Agent hosting | **In-process** (LangGraph in FastAPI) | No separate serving endpoint to manage; agent queries Lakebase directly via SQLAlchemy |
| Lakebase tier | **Autoscale** | Auto-manages capacity, simpler for demos |
| Pipeline language | **SQL** | Declarative, concise, maps directly to SDP |
| App framework | **apx** | Full-stack React + FastAPI with DI, OpenAPI codegen, Databricks Apps integration |
| Deployment | **DABs** | Single bundle manages all resources as code |
