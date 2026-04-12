#!/usr/bin/env bash
set -euo pipefail

PROFILE="${PROFILE:-vm}"
TARGET="${TARGET:-dev}"
DEPLOY_DATA=false
DEPLOY_PIPELINE=false
DEPLOY_LAKEBASE=false
DEPLOY_APP=false
DEPLOY_AGENT=false

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --all          Deploy everything in order
  --data         Generate sample data (run notebook 01)
  --pipeline     Deploy and run the SDP pipeline
  --lakebase     Setup Lakebase and sync gold data
  --app          Build and deploy the Databricks App
  --agent        Register and deploy the investment copilot agent
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
      DEPLOY_AGENT=true
      shift
      ;;
    --data)      DEPLOY_DATA=true; shift ;;
    --pipeline)  DEPLOY_PIPELINE=true; shift ;;
    --lakebase)  DEPLOY_LAKEBASE=true; shift ;;
    --app)       DEPLOY_APP=true; shift ;;
    --agent)     DEPLOY_AGENT=true; shift ;;
    --target)    TARGET="$2"; shift 2 ;;
    --profile)   PROFILE="$2"; shift 2 ;;
    -h|--help)   usage ;;
    *)           echo "Unknown option: $1"; usage ;;
  esac
done

if ! $DEPLOY_DATA && ! $DEPLOY_PIPELINE && ! $DEPLOY_LAKEBASE && ! $DEPLOY_APP && ! $DEPLOY_AGENT; then
  echo "No deployment targets specified. Use --all or specific flags."
  usage
fi

echo "=== Deploying to target: $TARGET (profile: $PROFILE) ==="

# Always deploy the bundle first to sync resources
echo "--- Deploying bundle ---"
databricks bundle deploy -t "$TARGET" -p "$PROFILE"

if $DEPLOY_DATA; then
  echo "--- Generating sample data ---"
  # Run notebook 01 via workspace API or job
  echo "TODO: Run src/notebooks/01_generate_sample_data.ipynb"
fi

if $DEPLOY_PIPELINE; then
  echo "--- Running SDP pipeline ---"
  databricks bundle run db_residential_sdp -t "$TARGET" -p "$PROFILE"
fi

if $DEPLOY_LAKEBASE; then
  echo "--- Setting up Lakebase ---"
  echo "TODO: Run src/notebooks/02_setup_lakebase.ipynb"
  echo "--- Syncing gold to Lakebase ---"
  databricks bundle run lakebase_sync -t "$TARGET" -p "$PROFILE"
fi

if $DEPLOY_APP; then
  echo "--- Deploying app (apx build runs automatically via bundle artifacts) ---"
  databricks bundle run db_residential_copilot_app -t "$TARGET" -p "$PROFILE"
fi

if $DEPLOY_AGENT; then
  echo "--- Deploying investment copilot agent ---"
  databricks bundle run deploy_agent -t "$TARGET" -p "$PROFILE"
fi

echo "=== Deployment complete ==="
