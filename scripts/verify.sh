#!/usr/bin/env bash
# Post-deploy verification for DonorDesk on Contabo.
# Mirrors contabo-ops.md §13 and Phase E §7: loopback bindings, /health, /ready,
# web, workers, Kestra, service status, and resources. Read-only.
set -euo pipefail

echo "--- loopback listeners (web/api/worker/kestra) ---"
if ! ss -lntH | grep -qE "127.0.0.1:(3002|4001|8092|8093)\b"; then
  echo "ERROR: expected loopback bindings missing" >&2
  ss -lntH | grep -E ":(3002|4001|8092|8093)\b" || true
  exit 1
fi
ss -lntH | grep -E "127.0.0.1:(3002|4001|8092|8093)\b"

echo "--- API ---"
curl -fsS http://127.0.0.1:4001/health && echo
curl -fsS http://127.0.0.1:4001/ready && echo

echo "--- Web ---"
curl -fsS -o /dev/null -w "web / -> %{http_code}\n" http://127.0.0.1:3002/

echo "--- Workers ---"
curl -fsS http://127.0.0.1:8092/health && echo
curl -fsS http://127.0.0.1:8092/ready && echo

echo "--- Kestra (if enabled) ---"
curl -fsS -o /dev/null -w "kestra configs -> %{http_code}\n" http://127.0.0.1:8093/api/v1/configs 2>/dev/null || echo "kestra not responding (not enabled?)"

echo "--- services ---"
systemctl --no-pager --full status donordesk-api donordesk-web donordesk-workers donordesk-kestra 2>/dev/null || true

echo "--- resources ---"
free -h | sed -n '1,2p'
df -h / | tail -1
