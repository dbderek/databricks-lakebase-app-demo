-- Bronze: Ingest raw property JSON from UC Volume via Auto Loader
CREATE OR REFRESH STREAMING TABLE startups_catalog.dbx_res_bronze.bronze_properties
CLUSTER BY (property_type, city)
TBLPROPERTIES (
  'delta.autoOptimize.optimizeWrite' = 'true',
  'delta.autoOptimize.autoCompact' = 'true'
)
AS
SELECT
  *,
  current_timestamp() AS _ingested_at,
  _metadata.file_path AS _source_file
FROM STREAM read_files(
  '/Volumes/startups_catalog/dbx_res_raw/data/properties/',
  format => 'json',
  schemaHints => 'property_id STRING, property_name STRING, address STRING, city STRING, state STRING, zip_code STRING, property_type STRING, asset_class STRING, units BIGINT, square_footage BIGINT, year_built BIGINT, acquisition_date STRING, purchase_price DOUBLE, current_appraised_value DOUBLE, market_id STRING'
);
