-- Silver: Clean, type-cast, and deduplicate rent records
CREATE OR REFRESH STREAMING TABLE startups_catalog.dbx_res_silver.silver_rents (
  CONSTRAINT valid_rent_id EXPECT (rent_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT valid_property_id EXPECT (property_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT valid_monthly_rent EXPECT (monthly_rent >= 0) ON VIOLATION DROP ROW
)
CLUSTER BY (rent_date, property_id)
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true'
)
AS
SELECT
  rent_id,
  property_id,
  unit_number,
  tenant_id,
  CAST(lease_start_date AS DATE) AS lease_start_date,
  CAST(lease_end_date AS DATE) AS lease_end_date,
  CAST(monthly_rent AS DECIMAL(10, 2)) AS monthly_rent,
  CAST(rent_collected AS DECIMAL(10, 2)) AS rent_collected,
  is_occupied,
  CAST(rent_date AS DATE) AS rent_date,
  _ingested_at
FROM STREAM startups_catalog.dbx_res_bronze.bronze_rents;
