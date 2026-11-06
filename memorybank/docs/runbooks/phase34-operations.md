# Phase 34 operations (DonorDesk Version 3.007)

Operator notes for the Phase 34 release (`releaseId=20261028133938`, 2026-10-28). Feature docs: `Features/53` to `58`. Plan and status: `imp/phase34-devresults-parity-plan.md`.

## What changed on the host

| Item | Detail |
|---|---|
| Tables | `SavedChart` (specification + last 10 versions), `DashboardTemplate`, `Bookmark`, `SavedReport` (the question only). All hold no figures. RLS forced, `tenant_isolation` policy. |
| Routes | `GET/POST /v1/charts`, `GET/PUT/DELETE /v1/charts/:id`; `/v1/dashboard-templates*`; `POST /v1/datasets/resolve`; `GET/POST /v1/saved-reports`, `PUT/DELETE /v1/saved-reports/:id`; `GET/POST /v1/bookmarks`, `DELETE /v1/bookmarks/:id`; indicator-sheet export/parse and `GET /v1/indicator-updates/:id/history`. All have a rule in `apps/api/src/middleware/authorization.ts`. |
| `/ready` | Requires `SavedChart.specJson`, `DashboardTemplate.json`, `Bookmark.href`, `SavedReport.queryJson`. A 503 with `missingPrismaFields` means the Prisma client is stale: re-run `prisma generate` against the shipped schema. |
| Settings | None added. |
| Rate limits | None added. The dashboard share-link pages keep their nginx limit from Phase 33. |

## Applying the migrations (the order that worked)

1. `systemctl start donordesk-backup.service`; read the last journal lines for the backup path and checksum.
2. Copy the migration folders to `/opt/donordesk/app/packages/infrastructure/prisma/migrations` on the host.
3. `set -a; . /opt/donordesk/shared/api.env; set +a; export DATABASE_URL="$DATABASE_ADMIN_URL"` then `node …/prisma/build/index.js migrate deploy --schema schema.prisma` from `…/packages/infrastructure/prisma`.
4. For each new tenant table run, as the admin URL: `GRANT SELECT, INSERT, UPDATE, DELETE … TO donordesk_app; ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY; DROP POLICY IF EXISTS tenant_isolation …; CREATE POLICY tenant_isolation … USING ("tenantId" = current_setting('app.current_tenant', true)) WITH CHECK (…)`. Applying per table avoids the single `DO` block aborting at a table the migrator does not own. Check `pg_class.relrowsecurity` and `relforcerowsecurity`.
5. `RELEASE_ID=… SCOPE=both SKIP_TYPECHECK=1 SSH="ssh -o ConnectTimeout=20 -o ConnectionAttempts=5 -o ServerAliveInterval=15 -o ServerAliveCountMax=8 contabo" scripts/deploy-fast.sh`. If verification fails with an SSH drop, retry with `SKIP_BUILD=1`.

## Checks after a release

- `https://donordesk.online/` 200, `/dashboards` 307 to sign-in, `/api/v1/projects` 401 without a key, `/ready` ready.
- Signed in: open a project's Data page → Charts, Maps, Report builder; the star in the header; a dashboard's Edit → Tabs.

## Known limits

- The new screens were not yet tried by a person in the signed-in app at the time of the release.
- The sentences the domain writes for notes and validation are English only; labels are in en, fr, es, ar (fr / es / ar are unreviewed drafts).
- The Maps screen draws on the bundled geography; there are no tiles and no uploaded layers yet.
