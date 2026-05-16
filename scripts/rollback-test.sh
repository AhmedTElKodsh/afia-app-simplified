#!/bin/bash
# Rollback test script — runs on CI Ubuntu runners
# Usage: ./scripts/rollback-test.sh [staging|production]
# Set DRY_RUN=true to list deployments without rolling back

ENV=${1:-staging}
WORKER_NAME="afia-stage1"
[ "$ENV" = "production" ] && WORKER_NAME="afia"

echo "=== Afia Worker Rollback Test ($ENV) ==="
echo "Worker: $WORKER_NAME"

# List recent deployments
echo "Fetching recent deployments..."
npx wrangler deployments list --name "$WORKER_NAME"

if [ "$DRY_RUN" = "true" ]; then
  echo "[Dry Run] No changes made. Run without DRY_RUN=false to rollback."
  exit 0
fi

# Execute rollback
echo "Rolling back $WORKER_NAME..."
npx wrangler rollback --name "$WORKER_NAME" || { echo "Rollback failed"; exit 1; }

# Smoke test
BASE_URL="https://afia-stage1.workers.dev"
[ "$ENV" = "production" ] && BASE_URL="https://afia.co"
echo "Running smoke test..."
curl -sf "$BASE_URL/api/health" -o /dev/null && echo "Smoke test passed" || echo "Smoke test failed"
