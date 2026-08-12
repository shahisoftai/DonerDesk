# Runbook — Phase 1 alerts

## API down
1. `curl http://localhost:4000/health` → 200 means process is up.
2. Check logs: `journalctl -u donordesk-api -n 200`.
3. Verify DB file exists: `ls packages/infrastructure/prisma/dev.db`.
4. Restart with `pnpm --filter @donordesk/api start`.

## Database connection lost
1. Check `DATABASE_URL` env var on the running process.
2. For SQLite dev: verify the path is writable.
3. For Postgres (Phase 2): check RDS status and IAM auth.

## High LLM cost
1. Switch provider to the cheaper tier via env var.
2. Inspect recent `llm_runs` (Phase 3 table).
3. Cache embeddings — skip re-embedding unchanged evidence (hash check).

## Readiness score drops unexpectedly
1. Open the report workspace for the affected period.
2. Review the checklist: each item is a derived signal (missing evidence,
   unverified indicators, late activity updates, unsupported claims).
3. Run "Run compliance check" to regenerate after fixes.
