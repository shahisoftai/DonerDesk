#!/usr/bin/env bash
# Deploys the versioned Kestra flows in this directory to a running Kestra server.
# Kestra's boot-time --flow-path loader runs before plugin JARs are registered, so
# flows that use plugin task types must be deployed through the Flows API instead.
set -euo pipefail

KESTRA_URL="${KESTRA_URL:-http://localhost:8080}"
KESTRA_USER="${KESTRA_USER:-admin@donordesk.local}"
KESTRA_PASSWORD="${KESTRA_PASSWORD:-DonorDesk123}"
KESTRA_TENANT="${KESTRA_TENANT:-main}"

flow_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! curl -sf -o /dev/null "${KESTRA_URL}/api/v1/configs"; then
  echo "Kestra is not reachable at ${KESTRA_URL}" >&2
  exit 1
fi

initialized="$(curl -sf "${KESTRA_URL}/api/v1/configs" | sed -n 's/.*"isBasicAuthInitialized":\([a-z]*\).*/\1/p')"
if [ "${initialized}" = "false" ]; then
  instance_uid="$(curl -sf "${KESTRA_URL}/api/v1/configs" | sed -n 's/.*"uuid":"\([^"]*\)".*/\1/p')"
  curl -sf -X POST "${KESTRA_URL}/api/v1/basicAuth" \
    -H "Content-Type: application/json" \
    -d "{\"uid\":\"${instance_uid}\",\"username\":\"${KESTRA_USER}\",\"password\":\"${KESTRA_PASSWORD}\"}" >/dev/null
  echo "Initialised Kestra basic auth for ${KESTRA_USER}"
fi

status=0
for flow in "${flow_dir}"/*.yml; do
  name="$(basename "${flow}")"
  code="$(curl --max-time 30 -s -o /tmp/kestra-flow-response -w '%{http_code}' \
    -u "${KESTRA_USER}:${KESTRA_PASSWORD}" \
    -X POST "${KESTRA_URL}/api/v1/${KESTRA_TENANT}/flows" \
    -H 'Content-Type: application/x-yaml' \
    --data-binary "@${flow}")"

  if [ "${code}" = "409" ] || [ "${code}" = "422" ]; then
    namespace="$(sed -n 's/^namespace:[[:space:]]*//p' "${flow}" | head -1)"
    id="$(sed -n 's/^id:[[:space:]]*//p' "${flow}" | head -1)"
    code="$(curl --max-time 30 -s -o /tmp/kestra-flow-response -w '%{http_code}' \
      -u "${KESTRA_USER}:${KESTRA_PASSWORD}" \
      -X PUT "${KESTRA_URL}/api/v1/${KESTRA_TENANT}/flows/${namespace}/${id}" \
      -H 'Content-Type: application/x-yaml' \
      --data-binary "@${flow}")"
  fi

  if [ "${code}" = "200" ] || [ "${code}" = "201" ]; then
    echo "Deployed ${name}"
  else
    echo "Failed to deploy ${name} (HTTP ${code})" >&2
    cat /tmp/kestra-flow-response >&2
    echo >&2
    status=1
  fi
done

exit "${status}"
