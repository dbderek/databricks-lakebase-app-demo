#!/usr/bin/env bash
# Build script for Databricks App deployment.
# Produces .build/ with the wheel, requirements.txt, and app.yml.
set -euo pipefail

cd "$(dirname "$0")"

BUILD_DIR=".build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "--- Building frontend ---"
bun run build

echo "--- Building Python wheel ---"
# Use a datestamp version to ensure the server picks up new code
BUILD_VERSION="1.0.$(date +%Y%m%d%H%M%S)"
cat > src/db_residential_copilot/_version.py << EOF
version = "${BUILD_VERSION}"
EOF
uv build --wheel --out-dir "$BUILD_DIR"

# Get the wheel filename
WHEEL=$(ls "$BUILD_DIR"/*.whl | head -1)
WHEEL_NAME=$(basename "$WHEEL")

echo "--- Generating requirements.txt ---"
uv pip compile pyproject.toml -o "$BUILD_DIR/requirements.txt" --quiet
# Add the local wheel to requirements so the runtime installs it
echo "./${WHEEL_NAME}" >> "$BUILD_DIR/requirements.txt"

echo "--- Copying app.yml ---"
cp app.yml "$BUILD_DIR/app.yml"

echo "--- Build complete (v${BUILD_VERSION}) ---"
ls -la "$BUILD_DIR"
