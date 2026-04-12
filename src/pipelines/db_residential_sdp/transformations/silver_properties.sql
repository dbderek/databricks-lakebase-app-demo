-- Silver: Clean, type-cast, and deduplicate properties
CREATE OR REFRESH STREAMING TABLE startups_catalog.silver.silver_properties (
  CONSTRAINT valid_property_id EXPECT (property_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT valid_purchase_price EXPECT (purchase_price > 0) ON VIOLATION DROP ROW,
  CONSTRAINT valid_units EXPECT (units > 0) ON VIOLATION DROP ROW
)
CLUSTER BY (property_type, city)
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true'
)
AS
SELECT
  property_id,
  property_name,
  address,
  city,
  state,
  zip_code,
  property_type,
  asset_class,
  CAST(units AS INT) AS units,
  CAST(square_footage AS INT) AS square_footage,
  CAST(year_built AS INT) AS year_built,
  CAST(acquisition_date AS DATE) AS acquisition_date,
  CAST(purchase_price AS DECIMAL(14, 2)) AS purchase_price,
  CAST(current_appraised_value AS DECIMAL(14, 2)) AS current_appraised_value,
  market_id,
  _ingested_at
FROM STREAM startups_catalog.bronze.bronze_properties;
