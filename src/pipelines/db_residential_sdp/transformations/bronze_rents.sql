-- Bronze: Ingest raw rent JSON from UC Volume via Auto Loader
CREATE OR REFRESH STREAMING TABLE db_residential_demo.bronze.bronze_rents
CLUSTER BY (rent_date)
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
  '/Volumes/db_residential_demo/raw/data/rents/',
  format => 'json',
  schemaHints => 'rent_id STRING, property_id STRING, unit_number STRING, tenant_id STRING, lease_start_date STRING, lease_end_date STRING, monthly_rent DOUBLE, rent_collected DOUBLE, is_occupied BOOLEAN, rent_date STRING'
);
