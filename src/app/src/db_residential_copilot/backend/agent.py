"""Investment Copilot Agent — LangGraph ReAct agent running in-process.

Initialised at app startup with the Lakebase SQLAlchemy engine for portfolio queries.
The agent uses ChatDatabricks (foundation model endpoint) and two tools:
  - portfolio_query: executes read-only SQL against Lakebase (gold + app schemas)
  - deal_forecast: runs a 5-year cash-flow projection
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool
from langchain_databricks import ChatDatabricks
from langgraph.prebuilt import create_react_agent
from sqlalchemy import Engine, text

from .core._config import logger

TABLE_DESCRIPTIONS = """
Available tables (PostgreSQL / Lakebase) and their columns:

1. gold.portfolio_metrics
   Per-property aggregated metrics:
   - property_id, property_name, address, city, state, zip_code
   - property_type (multifamily/single_family/mixed_use), asset_class (A/B/C)
   - units, square_footage, year_built, acquisition_date
   - purchase_price, current_appraised_value, market_id
   - avg_monthly_rent, avg_rent_collected
   - occupancy_rate_pct, collection_rate_pct
   - total_unit_months, latest_rent_date
   - annualized_gross_rent, cash_yield_pct, unrealized_gain

2. gold.portfolio_time_series
   Monthly portfolio-level metrics:
   - rent_month (DATE)
   - active_properties, total_aum, total_cost_basis
   - gross_potential_rent, effective_rent_collected, portfolio_collection_rate_pct
   - occupied_units, total_units, portfolio_occupancy_pct
   - annualized_cash_yield_pct
   - denver_properties, denver_occupancy_pct, other_occupancy_pct
"""

SYSTEM_PROMPT = f"""You are the Investment Copilot, an AI assistant for a residential real estate investment firm.

You help portfolio managers and analysts by:
1. Answering questions about the current portfolio (properties, occupancy, yields, trends)
2. Running deal underwriting forecasts for potential acquisitions
3. Identifying risks, opportunities, and actionable insights

## Available Data

{TABLE_DESCRIPTIONS}

## Guidelines

- When asked about the portfolio, use the portfolio_query tool with PostgreSQL-compatible SQL against the tables listed above.
- Use schema-qualified table names (e.g., gold.portfolio_metrics, gold.portfolio_time_series).
- When asked to evaluate a potential deal, use the deal_forecast tool with the provided assumptions.
- Always show your work: include the SQL you ran or the assumptions you used.
- Format financial numbers clearly (e.g., $1,234,567 or 5.2%).
- If you notice concerning trends (like the Denver vacancy spike), proactively flag them.
- Be concise but thorough. Lead with the key insight, then provide supporting detail.
- If the user's question is ambiguous, make reasonable assumptions and state them.
"""


# ---------------------------------------------------------------------------
# Module-level SQLAlchemy engine — set by create_agent() at startup
# ---------------------------------------------------------------------------
_engine: Engine | None = None


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@tool
def portfolio_query(sql: str) -> str:
    """Execute a read-only SQL query against the portfolio database (Lakebase/PostgreSQL).

    Use this to answer questions about properties, occupancy rates, yields,
    time-series trends, and portfolio composition. Only SELECT queries are allowed.

    Available tables:
    - gold.portfolio_metrics (per-property metrics)
    - gold.portfolio_time_series (monthly portfolio aggregates)
    """
    if _engine is None:
        return json.dumps({"error": "Database engine not initialised"})

    sql_stripped = sql.strip().rstrip(";").strip()
    if not sql_stripped.upper().startswith("SELECT"):
        return json.dumps({"error": "Only SELECT queries are allowed."})

    try:
        with _engine.connect() as conn:
            result = conn.execute(text(sql_stripped))
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
        return json.dumps({"rows": rows, "row_count": len(rows)}, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def deal_forecast(
    purchase_price: float,
    units: int,
    monthly_rent_per_unit: float,
    ltv_pct: float = 75.0,
    interest_rate_pct: float = 6.5,
    loan_term_years: int = 30,
    rent_growth_pct: float = 3.0,
    expense_ratio_pct: float = 35.0,
    exit_cap_rate_pct: float = 5.5,
    hold_years: int = 5,
) -> str:
    """Run a 5-year cash-flow projection for a potential real estate acquisition.

    Returns NOI, DSCR, cash-on-cash yield, IRR, equity multiple, NPV,
    and year-by-year cash flows. Use this when asked to evaluate a deal,
    run a scenario, or compare investment options.
    """
    ltv = ltv_pct / 100
    rate = interest_rate_pct / 100
    rent_growth = rent_growth_pct / 100
    expense_ratio = expense_ratio_pct / 100
    exit_cap = exit_cap_rate_pct / 100

    gross_rent = monthly_rent_per_unit * units * 12
    noi = gross_rent * (1 - expense_ratio)

    loan_amount = purchase_price * ltv
    equity = purchase_price - loan_amount
    monthly_rate = rate / 12
    num_payments = loan_term_years * 12

    if monthly_rate > 0:
        monthly_payment = loan_amount * (
            monthly_rate * (1 + monthly_rate) ** num_payments
        ) / ((1 + monthly_rate) ** num_payments - 1)
    else:
        monthly_payment = loan_amount / num_payments

    annual_debt_service = monthly_payment * 12
    dscr = noi / annual_debt_service if annual_debt_service > 0 else 0
    cash_flow_yr1 = noi - annual_debt_service
    cash_on_cash = (cash_flow_yr1 / equity * 100) if equity > 0 else 0

    cash_flows: list[float] = [-equity]
    yearly_detail = []
    for yr in range(1, hold_years + 1):
        yr_rent = gross_rent * (1 + rent_growth) ** yr
        yr_noi = yr_rent * (1 - expense_ratio)
        yr_cf = yr_noi - annual_debt_service

        detail: dict[str, Any] = {
            "year": yr,
            "gross_rent": round(yr_rent, 2),
            "noi": round(yr_noi, 2),
            "debt_service": round(annual_debt_service, 2),
            "cash_flow": round(yr_cf, 2),
        }

        if yr == hold_years:
            exit_noi = yr_rent * (1 + rent_growth) * (1 - expense_ratio)
            exit_value = exit_noi / exit_cap if exit_cap > 0 else 0
            if monthly_rate > 0:
                payments_made = hold_years * 12
                remaining_loan = loan_amount * (
                    (1 + monthly_rate) ** num_payments
                    - (1 + monthly_rate) ** payments_made
                ) / ((1 + monthly_rate) ** num_payments - 1)
            else:
                remaining_loan = loan_amount * (1 - hold_years / loan_term_years)
            sale_proceeds = exit_value - remaining_loan
            yr_cf += sale_proceeds
            detail["exit_value"] = round(exit_value, 2)
            detail["remaining_loan"] = round(remaining_loan, 2)
            detail["sale_proceeds"] = round(sale_proceeds, 2)
            detail["cash_flow"] = round(yr_cf, 2)

        cash_flows.append(yr_cf)
        yearly_detail.append(detail)

    irr = _calc_irr(cash_flows)
    total_distributions = sum(cash_flows[1:])
    equity_multiple = (total_distributions / equity) if equity > 0 else 0
    discount_rate = 0.08
    npv = sum(cf / (1 + discount_rate) ** i for i, cf in enumerate(cash_flows))

    result = {
        "summary": {
            "purchase_price": purchase_price,
            "equity_invested": round(equity, 2),
            "loan_amount": round(loan_amount, 2),
            "year_1_noi": round(noi, 2),
            "year_1_debt_service": round(annual_debt_service, 2),
            "dscr": round(dscr, 3),
            "cash_on_cash_pct": round(cash_on_cash, 2),
            "irr_pct": round(irr * 100, 2) if irr is not None else None,
            "equity_multiple": round(equity_multiple, 3),
            "npv_at_8pct": round(npv, 2),
        },
        "yearly_cash_flows": yearly_detail,
    }
    return json.dumps(result, default=str)


def _calc_irr(
    cash_flows: list[float], max_iter: int = 100, tol: float = 1e-7
) -> float | None:
    """Calculate IRR using Newton's method."""
    rate = 0.10
    for _ in range(max_iter):
        npv = sum(cf / (1 + rate) ** i for i, cf in enumerate(cash_flows))
        dnpv = sum(
            -i * cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cash_flows)
        )
        if abs(dnpv) < 1e-12:
            return rate
        new_rate = rate - npv / dnpv
        if abs(new_rate - rate) < tol:
            return new_rate
        rate = new_rate
    return rate


# ---------------------------------------------------------------------------
# Agent factory
# ---------------------------------------------------------------------------


def create_agent(engine: Engine, llm_endpoint: str = "databricks-claude-sonnet-4") -> Any:
    """Create and return a LangGraph ReAct agent.

    Called once during app startup. The SQLAlchemy engine is stored at module
    level so the ``portfolio_query`` tool can query Lakebase directly.
    """
    global _engine
    _engine = engine

    llm = ChatDatabricks(endpoint=llm_endpoint)
    agent = create_react_agent(llm, [portfolio_query, deal_forecast], prompt=SYSTEM_PROMPT)
    logger.info(f"Investment Copilot agent initialised (LLM: {llm_endpoint})")
    return agent
