#!/usr/bin/env bash
set -euo pipefail

PROFILE="${PROFILE:-vm}"
TARGET="${TARGET:-dev}"
CATALOG="startups_catalog"
PROJECT_ID="db-residential-copilot"
SCHEMAS=("dbx_res_gold" "dbx_res_silver" "dbx_res_bronze" "dbx_res_raw")

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Tears down all demo resources in reverse dependency order:
  1. Synced tables (Lakebase ← gold)
  2. Lakebase project (Postgres instance)
  3. UC schemas (gold, silver, bronze, raw) with CASCADE
  4. DABs bundle (pipeline, jobs, app, workspace files)

Options:
  --target T     Bundle target (default: dev)
  --profile P    Databricks CLI profile (default: vm)
  --skip-bundle  Skip databricks bundle destroy
  -y, --yes      Skip confirmation prompt
  -h, --help     Show this help message
EOF
  exit 0
}

SKIP_BUNDLE=false
AUTO_APPROVE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --target)       TARGET="$2"; shift 2 ;;
    --profile)      PROFILE="$2"; shift 2 ;;
    --skip-bundle)  SKIP_BUNDLE=true; shift ;;
    -y|--yes)       AUTO_APPROVE=true; shift ;;
    -h|--help)      usage ;;
    *)              echo "Unknown option: $1"; usage ;;
  esac
done

echo "=== Cleanup: target=$TARGET, profile=$PROFILE, catalog=$CATALOG ==="

if ! $AUTO_APPROVE; then
  read -rp "This will DELETE all demo resources. Continue? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Resolve warehouse ID for SQL statements
echo "--- Resolving SQL warehouse ---"
WAREHOUSE_ID=$(databricks warehouses list -p "$PROFILE" -o json | python3 -c "
import json, sys
for w in json.load(sys.stdin):
    if 'Starter' in w.get('name', '') or 'Serverless' in w.get('name', ''):
        print(w['id']); break
")
if [[ -z "$WAREHOUSE_ID" ]]; then
  echo "ERROR: No serverless warehouse found. Skipping schema drops."
else
  echo "  Using warehouse: $WAREHOUSE_ID"
fi

run_sql() {
  local stmt="$1"
  databricks api post /api/2.0/sql/statements -p "$PROFILE" --json "{
    \"warehouse_id\": \"$WAREHOUSE_ID\",
    \"statement\": \"$stmt\",
    \"wait_timeout\": \"30s\"
  }" 2>&1 | python3 -c "
import json, sys
d = json.load(sys.stdin)
state = d.get('status', {}).get('state', 'UNKNOWN')
err = d.get('status', {}).get('error', {}).get('message', '')
print(f'  {state}' + (f': {err}' if err else ''))
"
}

# Step 1: Delete synced tables
echo "--- Step 1: Deleting synced tables ---"
for table in "portfolio_metrics" "portfolio_time_series"; do
  synced_id="${CATALOG}.dbx_res_gold.${table}"
  echo "  Deleting synced table: $synced_id"
  databricks api delete "/api/2.0/postgres/synced_tables/${synced_id}" -p "$PROFILE" 2>/dev/null \
    && echo "    Deleted." \
    || echo "    Skipped (not found or already deleted)."
done

# Step 2: Delete Lakebase project
echo "--- Step 2: Deleting Lakebase project ---"
databricks api delete "/api/2.0/postgres/projects/${PROJECT_ID}" -p "$PROFILE" 2>/dev/null \
  && echo "  Deleted project: $PROJECT_ID" \
  || echo "  Skipped (not found or already deleted)."

# Step 3: Drop UC schemas
if [[ -n "$WAREHOUSE_ID" ]]; then
  echo "--- Step 3: Dropping UC schemas ---"
  for schema in "${SCHEMAS[@]}"; do
    echo "  DROP SCHEMA IF EXISTS ${CATALOG}.${schema} CASCADE"
    run_sql "DROP SCHEMA IF EXISTS ${CATALOG}.${schema} CASCADE"
  done
else
  echo "--- Step 3: SKIPPED (no warehouse) ---"
fi

# Step 4: Destroy DABs bundle
if ! $SKIP_BUNDLE; then
  echo "--- Step 4: Destroying DABs bundle ---"
  databricks bundle destroy -t "$TARGET" -p "$PROFILE" --auto-approve
else
  echo "--- Step 4: SKIPPED (--skip-bundle) ---"
fi

echo "=== Cleanup complete ==="
