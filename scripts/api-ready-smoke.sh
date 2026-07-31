#!/usr/bin/env bash
# Assert Hisaby API liveness + readiness (DB / Redis / S3 config).
# Usage:
#   ./scripts/api-ready-smoke.sh
#   ./scripts/api-ready-smoke.sh https://hisaby-api.onrender.com/api/health
#   API_HEALTH_URL=... ./scripts/api-ready-smoke.sh
set -euo pipefail

HEALTH_URL="${1:-${API_HEALTH_URL:-https://hisaby-api.onrender.com/api/health}}"
# Derive ready URL: .../health → .../health/ready
if [[ "$HEALTH_URL" == */health/ready ]]; then
  READY_URL="$HEALTH_URL"
  HEALTH_URL="${HEALTH_URL%/ready}"
elif [[ "$HEALTH_URL" == */health ]]; then
  READY_URL="${HEALTH_URL}/ready"
else
  READY_URL="${HEALTH_URL%/}/health/ready"
  HEALTH_URL="${HEALTH_URL%/}/health"
fi

echo "==> Liveness: $HEALTH_URL"
HEALTH_BODY="$(curl -fsS --retry 2 --retry-delay 3 --max-time 45 "$HEALTH_URL")"
echo "$HEALTH_BODY" | head -c 400
echo
echo "$HEALTH_BODY" | grep -q '"status":"ok"' || {
  echo "FAIL: liveness status is not ok"
  exit 1
}

echo "==> Readiness: $READY_URL"
READY_BODY="$(curl -fsS --retry 2 --retry-delay 3 --max-time 60 "$READY_URL")"
echo "$READY_BODY" | head -c 500
echo
echo "$READY_BODY" | grep -q '"status":"ready"' || {
  echo "FAIL: readiness status is not ready"
  exit 1
}

echo "OK — API live and ready"
