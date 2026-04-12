"""Investment copilot agent tools.

Two tools are available:
  - query_portfolio: Executes read-only SQL against Unity Catalog gold tables
  - forecast_deal: Runs a 5-year cash-flow projection with configurable assumptions
"""

import json
from dataclasses import dataclass

from databricks.sdk import WorkspaceClient

CATALOG = "startups_catalog"

# Tables the agent can query
AVAILABLE_TABLES = {
    "portfolio_metrics": f"{CATALOG}.gold.gold_portfolio_property_metrics",
    "time_series": f"{CATALOG}.gold.gold_portfolio_time_series",
}

TABLE_DESCRIPTIONS = """
Available tables and their columns:

1. startups_catalog.gold.gold_portfolio_property_metrics
   Per-property aggregated metrics:
   - property_id, property_name, address, city, state, zip_code
   - property_type (multifamily/single_family/mixed_use), asset_class (A/B/C)
   - units, square_footage, year_built, acquisition_date
   - purchase_price, current_appraised_value, market_id
   - avg_monthly_rent, avg_rent_collected
   - occupancy_rate_pct, collection_rate_pct
   - total_unit_months, latest_rent_date
   - annualized_gross_rent, cash_yield_pct, unrealized_gain

2. startups_catalog.gold.gold_portfolio_time_series
   Monthly portfolio-level metrics:
   - rent_month (DATE)
   - active_properties, total_aum, total_cost_basis
   - gross_potential_rent, effective_rent_collected, portfolio_collection_rate_pct
   - occupied_units, total_units, portfolio_occupancy_pct
   - annualized_cash_yield_pct
   - denver_properties, denver_occupancy_pct, other_occupancy_pct
"""


def query_portfolio(sql: str) -> str:
    """Execute a read-only SQL query against the portfolio gold tables.

    Args:
        sql: A SELECT query against the gold tables. Only SELECT statements are allowed.
             Available tables: startups_catalog.gold.gold_portfolio_property_metrics,
             startups_catalog.gold.gold_portfolio_time_series.

    Returns:
        JSON string of query results (list of row dicts), or an error message.
    """
    sql_stripped = sql.strip().rstrip(";").strip()
    if not sql_stripped.upper().startswith("SELECT"):
        return json.dumps({"error": "Only SELECT queries are allowed."})

    try:
        w = WorkspaceClient()
        result = w.statement_execution.execute_statement(
            warehouse_id=_get_warehouse_id(w),
            statement=sql_stripped,
            wait_timeout="30s",
        )
        if result.status and result.status.state and "FAILED" in str(result.status.state):
            return json.dumps({"error": str(result.status.error)})

        if not result.manifest or not result.result:
            return json.dumps({"rows": [], "message": "Query returned no results."})

        columns = [col.name for col in result.manifest.schema.columns]
        rows = []
        for row_data in result.result.data_array or []:
            rows.append(dict(zip(columns, row_data)))

        return json.dumps({"rows": rows, "row_count": len(rows)}, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


def _get_warehouse_id(w: WorkspaceClient) -> str:
    """Find the first available serverless SQL warehouse."""
    for wh in w.warehouses.list():
        if wh.warehouse_type and "PRO" in str(wh.warehouse_type):
            continue
        if wh.id:
            return wh.id
    warehouses = list(w.warehouses.list())
    if warehouses:
        return warehouses[0].id
    raise RuntimeError("No SQL warehouse found")


def forecast_deal(
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
    """Run a 5-year cash-flow projection for a potential real estate deal.

    Args:
        purchase_price: Total purchase price in dollars.
        units: Number of rental units.
        monthly_rent_per_unit: Monthly rent per unit in dollars.
        ltv_pct: Loan-to-value ratio as percentage (default 75).
        interest_rate_pct: Annual interest rate as percentage (default 6.5).
        loan_term_years: Loan amortization period in years (default 30).
        rent_growth_pct: Annual rent growth as percentage (default 3.0).
        expense_ratio_pct: Operating expenses as percentage of gross rent (default 35).
        exit_cap_rate_pct: Exit capitalization rate as percentage (default 5.5).
        hold_years: Investment hold period in years (default 5).

    Returns:
        JSON string with computed metrics: NOI, DSCR, cash-on-cash, IRR,
        equity multiple, NPV, and year-by-year cash flows.
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

    # Year-by-year cash flows
    cash_flows = [-equity]
    yearly_detail = []
    for yr in range(1, hold_years + 1):
        yr_rent = gross_rent * (1 + rent_growth) ** yr
        yr_noi = yr_rent * (1 - expense_ratio)
        yr_cf = yr_noi - annual_debt_service

        detail = {
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

    # IRR via Newton's method
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
