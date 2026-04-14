-- Gold: Per-property aggregated metrics for the portfolio overview
CREATE OR REFRESH MATERIALIZED VIEW startups_catalog.dbx_res_gold.gold_portfolio_property_metrics
CLUSTER BY (property_type, city)
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true'
)
AS
SELECT
  p.property_id,
  p.property_name,
  p.address,
  p.city,
  p.state,
  p.zip_code,
  p.property_type,
  p.asset_class,
  p.units,
  p.square_footage,
  p.year_built,
  p.acquisition_date,
  p.purchase_price,
  p.current_appraised_value,
  p.market_id,
  p.image_url,
  -- Rent metrics
  ROUND(r.avg_monthly_rent, 2) AS avg_monthly_rent,
  ROUND(r.avg_rent_collected, 2) AS avg_rent_collected,
  ROUND(r.occupancy_rate * 100, 1) AS occupancy_rate_pct,
  ROUND(r.collection_rate * 100, 1) AS collection_rate_pct,
  r.total_unit_months,
  r.latest_rent_date,
  -- Computed metrics
  ROUND(r.avg_monthly_rent * p.units * 12, 2) AS annualized_gross_rent,
  ROUND((r.avg_rent_collected * p.units * 12) / NULLIF(p.purchase_price, 0) * 100, 2) AS cash_yield_pct,
  ROUND(p.current_appraised_value - p.purchase_price, 2) AS unrealized_gain
FROM startups_catalog.dbx_res_silver.silver_properties p
LEFT JOIN (
  SELECT
    property_id,
    AVG(monthly_rent) AS avg_monthly_rent,
    AVG(rent_collected) AS avg_rent_collected,
    AVG(CAST(is_occupied AS DOUBLE)) AS occupancy_rate,
    SUM(rent_collected) / NULLIF(SUM(monthly_rent), 0) AS collection_rate,
    COUNT(*) AS total_unit_months,
    MAX(rent_date) AS latest_rent_date
  FROM startups_catalog.dbx_res_silver.silver_rents
  GROUP BY property_id
) r ON p.property_id = r.property_id;
