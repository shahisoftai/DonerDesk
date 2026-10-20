#!/usr/bin/env bash
# Fails when a database built from the checked-in migrations differs from
# schema.prisma in any way the raw SQL steps do not explain.
#
# The migrations used to be dead weight: CI built its database with
# `prisma db push`, so the 58 migration files were never executed and a
# divergence between them and the schema stayed invisible. This is the check
# that makes the next divergence fail the build.
#
# Usage: check-migration-drift.sh <database-url>
set -euo pipefail

DATABASE_URL="${1:?usage: check-migration-drift.sh <database-url>}"
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/packages/infrastructure"

cd "$PACKAGE_DIR"

DIFF="$(pnpm exec prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script 2>/dev/null || true)"

# The pgvector extension, its vector column and the HNSW cosine index are
# managed by infra/postgres/pgvector.sql: Prisma cannot express an
# Unsupported column or a raw HNSW index, so they are always "missing" from
# the datamodel. Everything else must match.
REMAINING="$(printf '%s\n' "$DIFF" \
  | grep -vE '^\s*$' \
  | grep -vE '^-- ' \
  | grep -vE 'DROP INDEX "evidence_embedding_hnsw_idx";' \
  || true)"

if [ -n "$REMAINING" ]; then
  echo "The database built from the checked-in migrations differs from schema.prisma:"
  printf '%s\n' "$REMAINING"
  echo
  echo "Add a migration under packages/infrastructure/prisma/migrations/ that closes the difference."
  exit 1
fi

echo "Migrations and schema.prisma agree."
