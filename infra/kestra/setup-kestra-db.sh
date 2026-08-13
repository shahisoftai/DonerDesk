#!/usr/bin/env bash
# Gated (Phase E): create the dedicated Kestra PostgreSQL role + database on Contabo.
#
# Kestra must use its own database/role (never embedded H2 in production).
# Run as the postgres admin (DONORDESK_DB_ADMIN_URL) once, before enabling
# donordesk-kestra. Idempotent: safe to re-run.
set -euo pipefail

DB_ADMIN_URL="${DONORDESK_DB_ADMIN_URL:-}"
if [[ -z "${DB_ADMIN_URL}" ]]; then
  echo "Error: set DONORDESK_DB_ADMIN_URL (postgres admin connection URL)." >&2
  exit 1
fi

KESTRA_ROLE="${KESTRA_ROLE:-donordesk_kestra}"
KESTRA_DB="${KESTRA_DB:-donordesk_kestra}"
KESTRA_DB_PASSWORD="${KESTRA_DB_PASSWORD:?KESTRA_DB_PASSWORD is required}"

psql "${DB_ADMIN_URL}" --set ON_ERROR_STOP=1 \
  --set role="${KESTRA_ROLE}" \
  --set db="${KESTRA_DB}" \
  --set pw="${KESTRA_DB_PASSWORD}" <<'SQL'
SELECT 'CREATE ROLE ' || :'role' || ' LOGIN PASSWORD ' || quote_literal(:'pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role') \gexec
SELECT 'CREATE DATABASE ' || :'db' || ' OWNER ' || :'role'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db') \gexec
SQL

echo "Kestra role '${KESTRA_ROLE}' and database '${KESTRA_DB}' ready."
