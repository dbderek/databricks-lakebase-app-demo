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

# Always deploy the bundle first to sync resources
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
  echo "--- Granting app SP access to Lakebase autoscale project ---"
  APP_NAME="db-residential-copilot-${TARGET}"
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
    }" 2>/dev/null && echo "  SP role created." || echo "  SP role already exists (or error — check manually)."
  else
    echo "  WARNING: Could not determine app SP client ID. App may not connect to Lakebase."
  fi

  echo "--- Deploying app ---"
  databricks bundle run db_residential_copilot_app -t "$TARGET" -p "$PROFILE"
fi

echo "=== Deployment complete ==="
