import json
import time
import uuid
from decimal import Decimal

from databricks.sdk.service.iam import User as UserOut
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import select

from .core import Dependencies, create_router, logger
from .models import (
    ChatAudit,
    ChatRequest,
    DealScenario,
    DealScenarioIn,
    DealScenarioOut,
    PortfolioMetric,
    PortfolioMetricOut,
    PortfolioOverviewOut,
    PortfolioTimeSeries,
    PortfolioTimeSeriesOut,
    VersionOut,
)

router = create_router()


# --- Utility ---


@router.get("/version", response_model=VersionOut, operation_id="version")
async def version():
    return VersionOut.from_metadata()


@router.get("/current-user", response_model=UserOut, operation_id="currentUser")
def me(user_ws: Dependencies.UserClient):
    return user_ws.current_user.me()


# --- Portfolio ---


@router.get(
    "/portfolio/overview",
    response_model=PortfolioOverviewOut,
    operation_id="getPortfolioOverview",
)
def get_portfolio_overview(session: Dependencies.Session):
    properties = session.exec(select(PortfolioMetric)).all()
    if not properties:
        return PortfolioOverviewOut(
            total_properties=0,
            total_units=0,
            total_aum=0.0,
            properties=[],
        )

    total_units = sum(p.units for p in properties)
    total_aum = float(sum(p.current_appraised_value for p in properties))
    occ_values = [float(p.occupancy_rate_pct) for p in properties if p.occupancy_rate_pct is not None]
    yield_values = [float(p.cash_yield_pct) for p in properties if p.cash_yield_pct is not None]
    rent_values = [float(p.annualized_gross_rent) for p in properties if p.annualized_gross_rent is not None]

    return PortfolioOverviewOut(
        total_properties=len(properties),
        total_units=total_units,
        total_aum=total_aum,
        avg_occupancy_pct=round(sum(occ_values) / len(occ_values), 1) if occ_values else None,
        avg_cash_yield_pct=round(sum(yield_values) / len(yield_values), 2) if yield_values else None,
        total_annualized_rent=round(sum(rent_values), 2) if rent_values else None,
        properties=[PortfolioMetricOut.model_validate(p, from_attributes=True) for p in properties],
    )


@router.get(
    "/portfolio/time-series",
    response_model=list[PortfolioTimeSeriesOut],
    operation_id="getPortfolioTimeSeries",
)
def get_portfolio_time_series(session: Dependencies.Session):
    rows = session.exec(select(PortfolioTimeSeries).order_by(PortfolioTimeSeries.rent_month)).all()  # ty: ignore[invalid-argument-type]
    return [PortfolioTimeSeriesOut.model_validate(r, from_attributes=True) for r in rows]


@router.get(
    "/properties/{property_id}",
    response_model=PortfolioMetricOut,
    operation_id="getProperty",
)
def get_property(property_id: str, session: Dependencies.Session):
    prop = session.get(PortfolioMetric, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail=f"Property {property_id} not found")
    return PortfolioMetricOut.model_validate(prop, from_attributes=True)


# --- Deals ---


def _compute_forecast(deal: DealScenario) -> DealScenario:
    """Compute deal financial metrics (NOI, DSCR, IRR, etc.)."""
    purchase = float(deal.purchase_price)
    units = deal.units
    monthly_rent = float(deal.monthly_rent_per_unit)
    ltv = float(deal.ltv_pct) / 100
    rate = float(deal.interest_rate_pct) / 100
    term = deal.loan_term_years
    rent_growth = float(deal.rent_growth_pct) / 100
    expense_ratio = float(deal.expense_ratio_pct) / 100
    exit_cap = float(deal.exit_cap_rate_pct) / 100
    hold = deal.hold_years

    # Year 1 NOI
    gross_rent = monthly_rent * units * 12
    noi = gross_rent * (1 - expense_ratio)

    # Loan
    loan_amount = purchase * ltv
    equity = purchase - loan_amount
    monthly_rate = rate / 12
    num_payments = term * 12
    if monthly_rate > 0:
        monthly_payment = loan_amount * (monthly_rate * (1 + monthly_rate) ** num_payments) / ((1 + monthly_rate) ** num_payments - 1)
    else:
        monthly_payment = loan_amount / num_payments
    annual_debt_service = monthly_payment * 12

    # DSCR
    dscr = noi / annual_debt_service if annual_debt_service > 0 else 0

    # Cash-on-cash
    cash_flow_yr1 = noi - annual_debt_service
    cash_on_cash = (cash_flow_yr1 / equity * 100) if equity > 0 else 0

    # IRR (simplified: annual cash flows + exit)
    cash_flows = [-equity]
    for yr in range(1, hold + 1):
        yr_rent = gross_rent * (1 + rent_growth) ** yr
        yr_noi = yr_rent * (1 - expense_ratio)
        yr_cf = yr_noi - annual_debt_service
        if yr == hold:
            exit_noi = yr_rent * (1 + rent_growth) * (1 - expense_ratio)
            exit_value = exit_noi / exit_cap if exit_cap > 0 else 0
            remaining_loan = loan_amount  # simplified
            if monthly_rate > 0:
                payments_made = hold * 12
                remaining_loan = loan_amount * ((1 + monthly_rate) ** num_payments - (1 + monthly_rate) ** payments_made) / ((1 + monthly_rate) ** num_payments - 1)
            yr_cf += exit_value - remaining_loan
        cash_flows.append(yr_cf)

    # Newton's method for IRR
    irr = _calc_irr(cash_flows)

    # Equity multiple
    total_distributions = sum(cash_flows[1:])
    equity_multiple = (total_distributions / equity) if equity > 0 else 0

    # NPV at 8% discount
    discount_rate = 0.08
    npv = sum(cf / (1 + discount_rate) ** i for i, cf in enumerate(cash_flows))

    deal.noi = Decimal(str(round(noi, 2)))
    deal.dscr = Decimal(str(round(dscr, 3)))
    deal.cash_on_cash_pct = Decimal(str(round(cash_on_cash, 2)))
    deal.irr_pct = Decimal(str(round(irr * 100, 2))) if irr is not None else None
    deal.equity_multiple = Decimal(str(round(equity_multiple, 3)))
    deal.npv = Decimal(str(round(npv, 2)))
    return deal


def _calc_irr(cash_flows: list[float], max_iter: int = 100, tol: float = 1e-7) -> float | None:
    """Calculate IRR using Newton's method."""
    rate = 0.10
    for _ in range(max_iter):
        npv = sum(cf / (1 + rate) ** i for i, cf in enumerate(cash_flows))
        dnpv = sum(-i * cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cash_flows))
        if abs(dnpv) < 1e-12:
            return rate
        new_rate = rate - npv / dnpv
        if abs(new_rate - rate) < tol:
            return new_rate
        rate = new_rate
    return rate


@router.post(
    "/deals",
    response_model=DealScenarioOut,
    operation_id="createDealForecast",
)
def create_deal_forecast(deal_in: DealScenarioIn, session: Dependencies.Session):
    deal = DealScenario(
        deal_id=str(uuid.uuid4()),
        **deal_in.model_dump(),
    )
    deal = _compute_forecast(deal)
    session.add(deal)
    session.commit()
    session.refresh(deal)
    return DealScenarioOut.model_validate(deal, from_attributes=True)


@router.get(
    "/deals",
    response_model=list[DealScenarioOut],
    operation_id="listDealScenarios",
)
def list_deals(session: Dependencies.Session):
    deals = session.exec(select(DealScenario).order_by(DealScenario.created_at.desc())).all()  # ty: ignore[unresolved-attribute]
    return [DealScenarioOut.model_validate(d, from_attributes=True) for d in deals]


@router.get(
    "/deals/{deal_id}",
    response_model=DealScenarioOut,
    operation_id="getDealScenario",
)
def get_deal(deal_id: str, session: Dependencies.Session):
    deal = session.get(DealScenario, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail=f"Deal {deal_id} not found")
    return DealScenarioOut.model_validate(deal, from_attributes=True)


# --- Chat (SSE Streaming) ---


@router.post("/chat", operation_id="chat")
def chat(
    req: ChatRequest,
    ws: Dependencies.Client,
    config: Dependencies.Config,
    session: Dependencies.Session,
    headers: Dependencies.Headers,
):
    start_time = time.time()

    def event_stream():
        full_response = []
        try:
            response = ws.serving_endpoints.query(
                name=config.serving_endpoint_name,
                messages=[ChatMessage(role=ChatMessageRole.USER, content=req.message)],
                stream=True,
            )
            for chunk in response:  # ty: ignore[not-iterable]
                if hasattr(chunk, "choices") and chunk.choices:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, "content") and delta.content:
                        full_response.append(delta.content)
                        yield f"data: {json.dumps({'content': delta.content})}\n\n"
        except Exception as e:
            logger.error(f"Chat error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

        # Log to audit
        try:
            answer = "".join(full_response)
            latency_ms = int((time.time() - start_time) * 1000)
            audit = ChatAudit(
                chat_id=str(uuid.uuid4()),
                user_email=headers.user_email,
                question=req.message,
                answer_summary=answer[:500] if answer else None,
                model_endpoint=config.serving_endpoint_name,
                latency_ms=latency_ms,
            )
            session.add(audit)
            session.commit()
        except Exception as e:
            logger.error(f"Chat audit log error: {e}")

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
