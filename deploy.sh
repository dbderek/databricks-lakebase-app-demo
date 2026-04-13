#!/usr/bin/env bash
set -euo pipefail

PROFILE="${PROFILE:-vm}"
TARGET="${TARGET:-dev}"
DEPLOY_DATA=false
DEPLOY_PIPELINE=false
DEPLOY_LAKEBASE=false
DEPLOY_APP=false

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --all          Deploy everything in order
  --data         Generate sample data (run notebook 01)
  --pipeline     Deploy and run the SDP pipeline
  --lakebase     Setup Lakebase and sync gold data
  --app          Build and deploy the Databricks App
  --target T     Bundle target (default: dev)
  --profile P    Databricks CLI profile (default: vm)
  -h, --help     Show this help message

Examples:
  ./deploy.sh --all
  ./deploy.sh --pipeline --app --target dev --profile vm
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      DEPLOY_DATA=true
      DEPLOY_PIPELINE=true
      DEPLOY_LAKEBASE=true
      DEPLOY_APP=true
      shift
      ;;
    --data)      DEPLOY_DATA=true; shift ;;
    --pipeline)  DEPLOY_PIPELINE=true; shift ;;
    --lakebase)  DEPLOY_LAKEBASE=true; shift ;;
    --app)       DEPLOY_APP=true; shift ;;
    --target)    TARGET="$2"; shift 2 ;;
    --profile)   PROFILE="$2"; shift 2 ;;
    -h|--help)   usage ;;
    *)           echo "Unknown option: $1"; usage ;;
  esac
done

if ! $DEPLOY_DATA && ! $DEPLOY_PIPELINE && ! $DEPLOY_LAKEBASE && ! $DEPLOY_APP; then
  echo "No deployment targets specified. Use --all or specific flags."
  usage
fi

echo "=== Deploying to target: $TARGET (profile: $PROFILE) ==="

# Ensure the Lakebase project exists before bundle deploy.
# The app resource references this database instance — terraform fails if it's missing.
# This is idempotent; the setup notebook will detect it already exists and skip creation.
echo "--- Ensuring Lakebase project exists ---"
PROJECT_EXISTS=$(databricks api get /api/2.0/postgres/projects/db-residential-copilot -p "$PROFILE" 2>/dev/null && echo "yes" || echo "no")
if [[ "$PROJECT_EXISTS" == "no" ]]; then
  echo "  Creating Lakebase project db-residential-copilot..."
  databricks api post "/api/2.0/postgres/projects?project_id=db-residential-copilot" -p "$PROFILE" --json '{
    "project": {
      "spec": {
        "display_name": "DB Residential Copilot",
        "pg_version": "17"
      }
    }
  }' > /dev/null 2>&1
  # Wait for endpoint to become available (needed before app can connect)
  echo "  Waiting for Lakebase endpoint..."
  for i in $(seq 1 30); do
    ENDPOINTS=$(databricks api get "/api/2.0/postgres/projects/db-residential-copilot/branches/production/endpoints" -p "$PROFILE" 2>/dev/null || echo "")
    if echo "$ENDPOINTS" | python3 -c "import json,sys; eps=json.load(sys.stdin).get('endpoints',[]); sys.exit(0 if eps else 1)" 2>/dev/null; then
      echo "  Lakebase endpoint ready."
      break
    fi
    sleep 10
  done
else
  echo "  Lakebase project already exists."
fi

# Deploy the bundle (creates pipeline, jobs, and app)
echo "--- Deploying bundle ---"
databricks bundle deploy -t "$TARGET" -p "$PROFILE"

if $DEPLOY_DATA; then
  echo "--- Generating sample data ---"
  databricks bundle run generate_sample_data -t "$TARGET" -p "$PROFILE"
fi

if $DEPLOY_PIPELINE; then
  echo "--- Running SDP pipeline ---"
  databricks bundle run db_residential_sdp -t "$TARGET" -p "$PROFILE"
fi

if $DEPLOY_LAKEBASE; then
  echo "--- Setting up Lakebase ---"
  databricks bundle run lakebase_setup -t "$TARGET" -p "$PROFILE"
  echo "--- Syncing gold to Lakebase ---"
  databricks bundle run lakebase_sync -t "$TARGET" -p "$PROFILE"
fi

if $DEPLOY_APP; then
  APP_NAME="db-residential-copilot-${TARGET}"

  echo "--- Configuring app SP + Lakebase permissions ---"
  SP_CLIENT_ID=$(databricks apps get "$APP_NAME" -p "$PROFILE" -o json | python3 -c "import json,sys; print(json.load(sys.stdin).get('service_principal_client_id',''))")
  if [ -n "$SP_CLIENT_ID" ]; then
    echo "  App SP client ID: $SP_CLIENT_ID"

    # Create a Postgres role for the SP (idempotent — will fail silently if already exists)
    databricks api post /api/2.0/postgres/projects/db-residential-copilot/branches/production/roles -p "$PROFILE" --json "{
      \"spec\": {
        \"postgres_role\": \"${SP_CLIENT_ID}\",
        \"identity_type\": \"SERVICE_PRINCIPAL\",
        \"attributes\": {
          \"createdb\": true
        }
      }
    }" 2>/dev/null && echo "  SP Postgres role created." || echo "  SP Postgres role already exists."

    # Grant Lakebase schema permissions via SDK + psycopg
    echo "  Granting Lakebase schema permissions..."
    python3 -c "
import psycopg
from databricks.sdk import WorkspaceClient

w = WorkspaceClient(profile='$PROFILE')
sp = '$SP_CLIENT_ID'
branch = 'projects/db-residential-copilot/branches/production'
ep_name = branch + '/endpoints/primary'

# Get connection details
endpoints = list(w.postgres.list_endpoints(parent=branch))
host = w.postgres.get_endpoint(name=endpoints[0].name).status.hosts.host
cred = w.postgres.generate_database_credential(endpoint=ep_name)
user = w.current_user.me().user_name

conn = psycopg.connect(host=host, port=5432, dbname='databricks_postgres', user=user, password=cred.token, sslmode='require')
conn.autocommit = True
cur = conn.cursor()

# Grant dbx_res_app schema (always exists after setup notebook)
for stmt in [
    f'GRANT USAGE ON SCHEMA dbx_res_app TO \"{sp}\"',
    f'GRANT ALL ON ALL TABLES IN SCHEMA dbx_res_app TO \"{sp}\"',
    f'ALTER DEFAULT PRIVILEGES IN SCHEMA dbx_res_app GRANT ALL ON TABLES TO \"{sp}\"',
]:
    try:
        cur.execute(stmt)
    except Exception as e:
        print(f'  Warning: {e}')

# Grant dbx_res_gold schema (exists after sync)
for stmt in [
    f'GRANT USAGE ON SCHEMA dbx_res_gold TO \"{sp}\"',
    f'GRANT SELECT ON ALL TABLES IN SCHEMA dbx_res_gold TO \"{sp}\"',
    f'ALTER DEFAULT PRIVILEGES IN SCHEMA dbx_res_gold GRANT SELECT ON TABLES TO \"{sp}\"',
]:
    try:
        cur.execute(stmt)
    except Exception as e:
        print(f'  Warning (gold may not be synced yet): {e}')

cur.close()
conn.close()
print('  Schema permissions granted.')
" 2>&1 | while read -r line; do echo "  $line"; done
  else
    echo "  WARNING: Could not determine app SP client ID. App may not connect to Lakebase."
  fi

  echo "--- Deploying app ---"
  databricks bundle run db_residential_copilot_app -t "$TARGET" -p "$PROFILE"
fi

echo "=== Deployment complete ==="
