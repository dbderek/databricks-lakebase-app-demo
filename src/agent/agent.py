"""Investment Copilot Agent — LangGraph ReAct agent with portfolio and forecast tools."""

import mlflow
from langchain_core.tools import tool
from langchain_databricks import ChatDatabricks
from langgraph.prebuilt import create_react_agent

from tools import TABLE_DESCRIPTIONS, forecast_deal, query_portfolio

SYSTEM_PROMPT = f"""You are the Investment Copilot, an AI assistant for a residential real estate investment firm.

You help portfolio managers and analysts by:
1. Answering questions about the current portfolio (properties, occupancy, yields, trends)
2. Running deal underwriting forecasts for potential acquisitions
3. Identifying risks, opportunities, and actionable insights

## Available Data

{TABLE_DESCRIPTIONS}

## Guidelines

- When asked about the portfolio, use the query_portfolio tool with SQL against the gold tables.
- When asked to evaluate a potential deal, use the forecast_deal tool with the provided assumptions.
- Always show your work: include the SQL you ran or the assumptions you used.
- Format financial numbers clearly (e.g., $1,234,567 or 5.2%).
- If you notice concerning trends (like the Denver vacancy spike), proactively flag them.
- Be concise but thorough. Lead with the key insight, then provide supporting detail.
- If the user's question is ambiguous, make reasonable assumptions and state them.
"""


@tool
def portfolio_query(sql: str) -> str:
    """Execute a read-only SQL query against the portfolio gold tables.

    Use this to answer questions about properties, occupancy rates, yields,
    time-series trends, and portfolio composition. Only SELECT queries are allowed.

    Available tables:
    - startups_catalog.gold.gold_portfolio_property_metrics (per-property metrics)
    - startups_catalog.gold.gold_portfolio_time_series (monthly portfolio aggregates)
    """
    return query_portfolio(sql)


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
    return forecast_deal(
        purchase_price=purchase_price,
        units=units,
        monthly_rent_per_unit=monthly_rent_per_unit,
        ltv_pct=ltv_pct,
        interest_rate_pct=interest_rate_pct,
        loan_term_years=loan_term_years,
        rent_growth_pct=rent_growth_pct,
        expense_ratio_pct=expense_ratio_pct,
        exit_cap_rate_pct=exit_cap_rate_pct,
        hold_years=hold_years,
    )


tools = [portfolio_query, deal_forecast]

llm = ChatDatabricks(endpoint="databricks-claude-sonnet-4")

agent = create_react_agent(llm, tools, prompt=SYSTEM_PROMPT)

# Set the MLflow model for logging
mlflow.models.set_model(agent)
