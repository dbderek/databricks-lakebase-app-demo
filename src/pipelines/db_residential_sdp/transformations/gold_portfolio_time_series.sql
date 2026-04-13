-- Gold: Monthly time-series of portfolio performance
CREATE OR REFRESH MATERIALIZED VIEW startups_catalog.dbx_res_gold.gold_portfolio_time_series
CLUSTER BY (rent_month)
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true'
)
AS
SELECT
  r.rent_date AS rent_month,
  -- Portfolio-level metrics
  COUNT(DISTINCT r.property_id) AS active_properties,
  SUM(p.current_appraised_value) AS total_aum,
  SUM(p.purchase_price) AS total_cost_basis,
  -- Rent metrics
  SUM(r.monthly_rent) AS gross_potential_rent,
  SUM(r.rent_collected) AS effective_rent_collected,
  ROUND(SUM(r.rent_collected) / NULLIF(SUM(r.monthly_rent), 0) * 100, 1) AS portfolio_collection_rate_pct,
  -- Occupancy
  SUM(CAST(r.is_occupied AS INT)) AS occupied_units,
  COUNT(*) AS total_units,
  ROUND(AVG(CAST(r.is_occupied AS DOUBLE)) * 100, 1) AS portfolio_occupancy_pct,
  -- Cash yield
  ROUND(SUM(r.rent_collected) * 12 / NULLIF(SUM(p.purchase_price), 0) * 100, 2) AS annualized_cash_yield_pct,
  -- Denver vs rest (for the vacancy story)
  COUNT(DISTINCT r.property_id) FILTER (WHERE p.city = 'Denver') AS denver_properties,
  ROUND(AVG(CAST(r.is_occupied AS DOUBLE)) FILTER (WHERE p.city = 'Denver') * 100, 1) AS denver_occupancy_pct,
  ROUND(AVG(CAST(r.is_occupied AS DOUBLE)) FILTER (WHERE p.city != 'Denver') * 100, 1) AS other_occupancy_pct
FROM startups_catalog.dbx_res_silver.silver_rents r
JOIN startups_catalog.dbx_res_silver.silver_properties p ON r.property_id = p.property_id
GROUP BY r.rent_date
ORDER BY r.rent_date;
