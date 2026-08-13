#!/usr/bin/env bash
# Read-only preflight for a DonorDesk / Kestra deployment on Contabo.
# Mirrors contabo-ops.md §12 plus the new-service port check (Phase E §1).
# Safe to run at any time; it changes nothing.
set -euo pipefail

date --iso-8601=seconds
. /etc/os-release; echo "OS: ${PRETTY_NAME}"
echo "Kernel: $(uname -r)"
echo "--- memory ---"
free -h | sed -n '1,2p'
echo "--- disk ---"
df -h / | tail -1
echo "--- load ---"
uptime

echo "--- candidate new-service ports (must be free) ---"
for p in 8092 8093 8094; do
  if ss -lntH "sport = :$p" | grep -q .; then echo "$p OCCUPIED"; else echo "$p free"; fi
done

echo "--- existing DonorDesk / occupied loopback listeners ---"
ss -lntH | grep -E ":(3002|4001|8080|8081|8082|8090|8091)\b" || echo "(none observed)"

echo "--- active services ---"
for s in postgresql@16-main redis-server docker lshttpd nghttpx donordesk-api donordesk-web; do
  printf '%s: %s\n' "$s" "$(systemctl is-active "$s" 2>/dev/null || echo unknown)"
done
