from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel
from sqlmodel import Field, SQLModel

from .. import __version__


class VersionOut(BaseModel):
    version: str

    @classmethod
    def from_metadata(cls):
        return cls(version=__version__)


# --- Portfolio Metrics (read-only, synced from gold via Lakebase) ---


class PortfolioMetric(SQLModel, table=True):
    __tablename__ = "portfolio_metrics"
    __table_args__ = {"schema": "dbx_res_gold"}

    property_id: str = Field(primary_key=True)
    property_name: str
    address: str
    city: str
    state: str
    zip_code: str
    property_type: str
    asset_class: str
    units: int
    square_footage: int
    year_built: int
    acquisition_date: date
    purchase_price: Decimal = Field(max_digits=14, decimal_places=2)
    current_appraised_value: Decimal = Field(max_digits=14, decimal_places=2)
    market_id: str
    image_url: Optional[str] = None
    avg_monthly_rent: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=2)
    avg_rent_collected: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=2)
    occupancy_rate_pct: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=1)
    collection_rate_pct: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=1)
    total_unit_months: Optional[int] = None
    latest_rent_date: Optional[date] = None
    annualized_gross_rent: Optional[Decimal] = Field(default=None, max_digits=14, decimal_places=2)
    cash_yield_pct: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2)
    unrealized_gain: Optional[Decimal] = Field(default=None, max_digits=14, decimal_places=2)


class PortfolioMetricOut(BaseModel):
    property_id: str
    property_name: str
    address: str
    city: str
    state: str
    zip_code: str
    property_type: str
    asset_class: str
    units: int
    square_footage: int
    year_built: int
    acquisition_date: date
    purchase_price: float
    current_appraised_value: float
    market_id: str
    image_url: Optional[str] = None
    avg_monthly_rent: Optional[float] = None
    avg_rent_collected: Optional[float] = None
    occupancy_rate_pct: Optional[float] = None
    collection_rate_pct: Optional[float] = None
    total_unit_months: Optional[int] = None
    latest_rent_date: Optional[date] = None
    annualized_gross_rent: Optional[float] = None
    cash_yield_pct: Optional[float] = None
    unrealized_gain: Optional[float] = None


# --- Portfolio Time Series (read-only, synced from gold) ---


class PortfolioTimeSeries(SQLModel, table=True):
    __tablename__ = "portfolio_time_series"
    __table_args__ = {"schema": "dbx_res_gold"}

    rent_month: date = Field(primary_key=True)
    active_properties: int
    total_aum: Decimal = Field(max_digits=16, decimal_places=2)
    total_cost_basis: Decimal = Field(max_digits=16, decimal_places=2)
    gross_potential_rent: Decimal = Field(max_digits=14, decimal_places=2)
    effective_rent_collected: Decimal = Field(max_digits=14, decimal_places=2)
    portfolio_collection_rate_pct: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=1)
    occupied_units: int
    total_units: int
    portfolio_occupancy_pct: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=1)
    annualized_cash_yield_pct: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2)
    denver_properties: Optional[int] = None
    denver_occupancy_pct: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=1)
    other_occupancy_pct: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=1)


class PortfolioTimeSeriesOut(BaseModel):
    rent_month: date
    active_properties: int
    total_aum: float
    total_cost_basis: float
    gross_potential_rent: float
    effective_rent_collected: float
    portfolio_collection_rate_pct: Optional[float] = None
    occupied_units: int
    total_units: int
    portfolio_occupancy_pct: Optional[float] = None
    annualized_cash_yield_pct: Optional[float] = None
    denver_properties: Optional[int] = None
    denver_occupancy_pct: Optional[float] = None
    other_occupancy_pct: Optional[float] = None


# --- Deal Scenarios (read-write, app-managed) ---


class DealScenario(SQLModel, table=True):
    __tablename__ = "deal_scenarios"
    __table_args__ = {"schema": "dbx_res_app"}

    deal_id: str = Field(primary_key=True)
    property_name: str
    city: Optional[str] = None
    state: Optional[str] = None
    property_type: Optional[str] = None
    purchase_price: Decimal = Field(max_digits=14, decimal_places=2)
    units: int = 1
    monthly_rent_per_unit: Decimal = Field(max_digits=10, decimal_places=2)
    ltv_pct: Decimal = Field(default=Decimal("75.0"), max_digits=5, decimal_places=2)
    interest_rate_pct: Decimal = Field(default=Decimal("6.5"), max_digits=5, decimal_places=3)
    loan_term_years: int = 30
    rent_growth_pct: Decimal = Field(default=Decimal("3.0"), max_digits=5, decimal_places=2)
    expense_ratio_pct: Decimal = Field(default=Decimal("35.0"), max_digits=5, decimal_places=2)
    exit_cap_rate_pct: Decimal = Field(default=Decimal("5.5"), max_digits=5, decimal_places=3)
    hold_years: int = 5
    noi: Optional[Decimal] = Field(default=None, max_digits=14, decimal_places=2)
    dscr: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=3)
    cash_on_cash_pct: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2)
    irr_pct: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2)
    equity_multiple: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=3)
    npv: Optional[Decimal] = Field(default=None, max_digits=14, decimal_places=2)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DealScenarioIn(BaseModel):
    property_name: str
    city: Optional[str] = None
    state: Optional[str] = None
    property_type: Optional[str] = None
    purchase_price: float
    units: int = 1
    monthly_rent_per_unit: float
    ltv_pct: float = 75.0
    interest_rate_pct: float = 6.5
    loan_term_years: int = 30
    rent_growth_pct: float = 3.0
    expense_ratio_pct: float = 35.0
    exit_cap_rate_pct: float = 5.5
    hold_years: int = 5


class DealScenarioOut(BaseModel):
    deal_id: str
    property_name: str
    city: Optional[str] = None
    state: Optional[str] = None
    property_type: Optional[str] = None
    purchase_price: float
    units: int
    monthly_rent_per_unit: float
    ltv_pct: float
    interest_rate_pct: float
    loan_term_years: int
    rent_growth_pct: float
    expense_ratio_pct: float
    exit_cap_rate_pct: float
    hold_years: int
    noi: Optional[float] = None
    dscr: Optional[float] = None
    cash_on_cash_pct: Optional[float] = None
    irr_pct: Optional[float] = None
    equity_multiple: Optional[float] = None
    npv: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# --- Chat ---


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    model: Optional[str] = None


class ChatAudit(SQLModel, table=True):
    __tablename__ = "chat_audit"
    __table_args__ = {"schema": "dbx_res_app"}

    chat_id: str = Field(primary_key=True)
    user_email: Optional[str] = None
    question: str
    answer_summary: Optional[str] = None
    model_endpoint: Optional[str] = None
    latency_ms: Optional[int] = None
    created_at: Optional[datetime] = None


# --- Portfolio Overview (aggregated response) ---


class PortfolioOverviewOut(BaseModel):
    total_properties: int
    total_units: int
    total_aum: float
    avg_occupancy_pct: Optional[float] = None
    avg_cash_yield_pct: Optional[float] = None
    total_annualized_rent: Optional[float] = None
    properties: list[PortfolioMetricOut]
