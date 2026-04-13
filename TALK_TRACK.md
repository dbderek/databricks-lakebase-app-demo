# Databricks Residential Investment Copilot — Demo Talk Track

---

## Demo Resources

| Resource | Link |
|---|---|
| **App (live)** | https://db-residential-copilot-dev-7474656350151049.aws.databricksapps.com |
| **Workspace** | https://fevm-startups.cloud.databricks.com |
| **SDP Pipeline** | https://fevm-startups.cloud.databricks.com/pipelines/caa6da71-b9a5-4670-82f2-c4f6aaabd8e5 |
| **Unity Catalog** | https://fevm-startups.cloud.databricks.com/explore/data/startups_catalog |
| **Lakebase Project** | https://fevm-startups.cloud.databricks.com/sql/databases/db-residential-copilot |
| **Bundle Files** | `/Workspace/Users/derek.witt@databricks.com/.bundle/db-residential-investment-copilot/dev/files` |
| **GitHub Repo** | https://github.com/dbderek/databricks-lakebase-app-demo |

---

## Opening (2 min)

**The problem:** Real estate investment firms run fragmented tech stacks — a data warehouse here, a Postgres database there, a separate ML platform, a custom React app stitched together with API keys. Every seam is a governance gap.

**The pitch:** What if the entire stack — data engineering, operational database, application hosting, and AI — ran on one platform with one governance model? That's what we built.

**What you're about to see:**
1. Raw data flowing through a governed lakehouse pipeline
2. Curated data synced to an operational PostgreSQL database (Lakebase)
3. A modern full-stack app running natively on Databricks
4. An AI copilot that queries live portfolio data and runs financial models — choosing from Claude, GPT-5, or Gemini models served through Databricks

---

## Act 1: The Data Foundation (5 min)

### Unity Catalog — Governed Source of Truth

Open the **Unity Catalog** link. Navigate to `startups_catalog`.

> "Everything starts with Unity Catalog. We have a single catalog with four schemas that represent our data lifecycle — raw, bronze, silver, gold. Every table is governed, auditable, and lineage-tracked."

Show the schema hierarchy: `raw` → `bronze` → `silver` → `gold`.

### SDP Pipeline — Bronze to Gold

Open the **SDP Pipeline** link.

> "This is a Lakeflow Declarative Pipeline — all SQL, no Python boilerplate. Raw JSON files land in a UC Volume. Auto Loader picks them up as streaming tables, we clean and deduplicate in silver, then aggregate into gold materialized views."

Click through the pipeline DAG. Highlight:
- **Bronze:** Auto Loader streaming tables (schema inference, rescue column)
- **Silver:** Type casting, dedup by primary key, quality constraints (`EXPECT ... ON VIOLATION DROP ROW`)
- **Gold:** Two materialized views — per-property metrics and monthly portfolio time series

> "The gold layer is where it gets interesting. We join properties with 18 months of rent records to compute occupancy rates, cash yields, and unrealized gains — all as materialized views that refresh incrementally."

### Lineage

Navigate to one of the gold tables and show the lineage tab.

> "Unity Catalog tracks lineage automatically. You can see exactly how this gold metric was derived — which silver table, which bronze source, all the way back to the JSON files in the volume."

---

## Act 2: Lakebase — Operational Database (3 min)

Open the **Lakebase Project** link.

> "Gold tables are great for analytics, but apps need sub-millisecond reads and the ability to write back. That's Lakebase — a fully managed PostgreSQL database that lives inside Databricks."

Show the tables in the `app` schema:
- `portfolio_metrics` — synced from gold (read path)
- `deal_scenarios` — written by the app (write path)
- `chat_audit` — written by the copilot (audit trail)

> "The portfolio metrics table is a synced table — it mirrors the gold layer and refreshes automatically after each pipeline run. But deal scenarios and chat audit are app-managed tables. The app reads governed data and writes user-generated data back, all through the same PostgreSQL connection."

> "This is the key pattern: the lakehouse is the source of truth, Lakebase is the operational interface. One governance model, two access patterns."

---

## Act 3: The App (5 min)

Open the **App** link.

### Landing Page

> "This is a Databricks App — React frontend, FastAPI backend, running natively on Databricks infrastructure. No external hosting, no API gateway. The app's service principal inherits Unity Catalog permissions automatically."

### Portfolio Dashboard

Click **Portfolio Analytics** in the nav.

> "The portfolio dashboard pulls live data from Lakebase. KPIs, AUM trends, occupancy comparisons, property distribution — all rendered client-side from the API."

Point out specific insights:
- The **Denver occupancy dip** (this is the "story" baked into the synthetic data)
- Month-over-month delta badges on KPI cards
- The occupancy distribution histogram

> "Notice the Denver occupancy trend diverging from the rest of the portfolio. That's a real signal — the kind of thing a portfolio manager needs to catch early."

### Deal Underwriting

Click **Deal Lab** in the nav.

> "Beyond monitoring, the app supports forward-looking analysis. This is a deal underwriting tool — enter a property's financials, and it computes a 5-year projection."

Fill in a sample deal:
- Property: "Parkside Apartments"
- City: Austin, State: TX
- Purchase price: $10,000,000
- Units: 80
- Monthly rent: $1,500
- Keep defaults for LTV, rate, etc.

Click **Run Forecast**.

> "NOI, DSCR, IRR, equity multiple, NPV — all computed server-side and persisted to Lakebase. Every scenario is saved, so you can compare deals over time."

---

## Act 4: The AI Copilot (5 min)

Click **Copilot** in the nav.

> "This is the piece that ties it all together. The Investment Copilot is a LangGraph ReAct agent running in-process inside the FastAPI backend. It has two tools: one to query portfolio data via SQL, and one to run deal forecasts."

### Show the model selector

Click the model dropdown in the top right.

> "The agent talks to foundation models through Databricks Model Serving. We're not locked into one provider — you can choose Claude, GPT-5, or Gemini, all served through the same Databricks endpoint. Same governance, same audit trail, regardless of which model you pick."

### Demo queries

Try these in order:

**1. Portfolio question:**
> Type: "What's our current exposure to Denver?"

> "The agent writes SQL against Lakebase, executes it, and synthesizes the answer. Notice it's querying the same `gold.portfolio_metrics` table the dashboard uses."

**2. Trend analysis:**
> Type: "Show me properties with occupancy below 85%"

> "It identifies the underperformers — and if you ask, it'll explain why. The Denver vacancy spike is something it can surface proactively."

**3. Deal forecast:**
> Type: "Run a 5-year forecast for a $10M, 80-unit multifamily in Austin"

> "Now it's using the deal forecast tool — same financial model as the underwriting page, but invoked conversationally. The agent decides which tool to use based on the question."

**4. Switch models:**
Select a different model (e.g., GPT-5) and ask a follow-up.

> "Same tools, same data, different model. The agent architecture is model-agnostic — you can evaluate which foundation model works best for your use case without changing any code."

---

## Closing (2 min)

> "Let's step back and look at what's running here:"

Count on fingers:

1. **Unity Catalog** — governed data from raw JSON to gold metrics
2. **Lakeflow Pipeline** — declarative SQL, serverless, incremental refresh
3. **Lakebase** — operational PostgreSQL, synced from the lakehouse, sub-millisecond reads
4. **Databricks App** — React + FastAPI, hosted natively, no external infra
5. **Foundation Model APIs** — multi-model AI through a single gateway
6. **LangGraph Agent** — tools that query governed data and run financial models

> "Six capabilities, one platform, one governance layer. The data that feeds the dashboard is the same data the AI queries. The audit trail for copilot conversations lives in the same database as deal scenarios. There are no seams."

> "And all of it deploys with a single command: `./deploy.sh --all`."

---

## Handling Questions

**Q: Can the agent write data, or just read?**
> Currently the portfolio_query tool is read-only (SELECT only). The deal_forecast tool computes in-memory and returns results. The app's API endpoints handle writes to Lakebase.

**Q: How does auth work for the app?**
> The Databricks App framework provides a service principal automatically. The app inherits Unity Catalog permissions through that SP. Users authenticate via Databricks SSO — no separate auth system.

**Q: What about production scale?**
> Lakebase Autoscale handles capacity automatically (0.5–4 CU, scale to zero). The SDP pipeline runs serverless with Photon. The app runs on Databricks Apps compute. Foundation model endpoints are managed by Databricks. There's nothing to manually scale.

**Q: Can we use our own fine-tuned models?**
> Yes — any model deployed to a Databricks serving endpoint works. Just add the endpoint name to the model list. The ChatDatabricks integration handles the rest.
