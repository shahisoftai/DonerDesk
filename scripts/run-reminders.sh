#!/usr/bin/env bash
# Runs the daily reminders for every organisation. Called every hour by donordesk-reminders.timer.
#
# The API does something only in an organisation's own 07:00 hour (its time zone is on the organisation), so calling it every hour
# for everyone is cheap and correct. Each call is for ONE organisation and is signed the same way Kestra's calls are
# (INTERNAL_TOKEN + an HMAC over METHOD, PATH, TENANT, TIMESTAMP and BODY), so organisations stay isolated by the API itself.
#
# Install once (deploy-fast.sh does not ship scripts/): install -m 0755 scripts/run-reminders.sh /opt/donordesk/shared/bin/run-reminders.sh
# Needs: /opt/donordesk/shared/api.env (INTERNAL_TOKEN, INTERNAL_HMAC_SECRET, PORT), the API on 127.0.0.1,
# and `sudo -u postgres psql` to list organisations (the app role cannot see across organisations).
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/donordesk/shared/api.env}"
DB="${DB_NAME:-donordesk}"
FORCE="${FORCE:-false}"   # FORCE=true sends now instead of waiting for 07:00 (the ledger still prevents a second summary the same day)

set -a; . "$ENV_FILE"; set +a
API="${API_URL:-http://127.0.0.1:${PORT:-4000}}"
: "${INTERNAL_TOKEN:?INTERNAL_TOKEN is not set in $ENV_FILE}"
: "${INTERNAL_HMAC_SECRET:?INTERNAL_HMAC_SECRET is not set in $ENV_FILE}"

PATH_="/internal/reminders/run"
BODY="{\"force\":${FORCE}}"
failed=0

mapfile -t TENANTS < <(sudo -u postgres psql -At -d "$DB" -c 'SELECT "tenantId" FROM "Organization" ORDER BY "tenantId"')
for TENANT in "${TENANTS[@]}"; do
  TS="$(date +%s)"
  SIG="$(printf 'POST\n%s\n%s\n%s\n%s' "$PATH_" "$TENANT" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$INTERNAL_HMAC_SECRET" -binary | base64)"
  if OUT="$(curl -fsS -m 120 -X POST "$API$PATH_" \
      -H 'content-type: application/json' \
      -H "x-internal-token: $INTERNAL_TOKEN" -H "x-tenant-id: $TENANT" -H "x-internal-timestamp: $TS" -H "x-internal-signature: $SIG" \
      --data "$BODY")"; then
    echo "$TENANT $OUT"
  else
    echo "$TENANT FAILED" >&2
    failed=1
  fi
done
exit "$failed"
