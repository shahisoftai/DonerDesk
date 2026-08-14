# Contabo Fast Deployment — DonorDesk

**Preferred frequent-release path:** checksummed incremental immutable releases.

**Validated on production:** 2026-08-14, release `20260814154500`.

**Fallback:** the full tarball procedure in `CONTABO-LEAN-DEPLOYMENT.md`.

## Design

Build off-host, clone the current release into a staging directory using hard
links, and use checksummed `rsync` to replace only changed files. Then atomically
switch `/opt/donordesk/current`, restart only affected DonorDesk services, and
run bounded health checks. A failed verification automatically restores the
previous symlink and restarts the same services.

The hard-linked staging release does not mutate the preceding release: rsync
writes changed files through temporary-file-and-rename behavior. Never edit a
file in a completed release in place.

## Normal release

```bash
release_id="$(date -u +%Y%m%d%H%M%S)"

# Required release gate. CI may run these once and retain the build outputs.
pnpm -r typecheck
pnpm -r test
pnpm -r build

# SKIP_BUILD is allowed only because the gate above produced this artifact.
RELEASE_ID="$release_id" CREATE_TARBALL=0 SKIP_BUILD=1 \
  scripts/package-release.sh

# Select only services affected by the change.
RELEASE_ID="$release_id" \
RELEASE_DIR="/tmp/dd-release-$release_id" \
SERVICES="donordesk-api donordesk-web" \
  scripts/deploy-incremental.sh
```

Allowed `SERVICES` values are `donordesk-api`, `donordesk-web`, and
`donordesk-superadmin`. The current packager updates API/web and intentionally
preserves the existing `superadmin/` tree. Use the full release path when
SuperAdmin itself changes until it is added to the fast packager.

## Database changes

Do not hide migrations inside the fast switch. Before activation:

1. Confirm the latest off-host backup.
2. Inspect the checked-in migration and require expand/migrate/contract
   compatibility with the preceding app release.
3. Run bundled `prisma migrate deploy` using the root-only migrator environment.
4. Apply and verify RLS as documented in `CONTABO-LEAN-DEPLOYMENT.md`.
5. Deploy the application and run public acceptance checks.

Destructive or backward-incompatible migrations require the full controlled
release procedure and an approved maintenance window.

## Measured pilot

| Stage | Result |
|---|---:|
| Full workspace build on the development host | 151.5 s |
| Artifact assembly with existing build outputs | 23.9 s |
| Logical hardened artifact size | 811 MB |
| First hardened incremental deployment | 86.2 s |
| No-change checksummed comparison | 17.5 s; zero files transferred |
| API startup observed on Contabo | about 9 s |

The first migration from the old artifact layout sent 8.5 MB despite comparing a
1.05-GB logical tree. The hardened follow-up sent 5.9 MB while removing build
caches, sources, tests, development databases, and local environment files.

Routine cached deployments should normally finish in roughly one minute after
an artifact exists. Dependency changes and full Next.js builds take longer.

## Security and operational rules

- The artifact builder deletes `.env`, `.env.*`, `dev.db`, TypeScript build
  metadata, source/test trees, and Next.js build caches.
- Runtime secrets remain under `/opt/donordesk/shared`; never copy them into a
  release.
- Do not run installs or builds on Contabo.
- Do not restart PM2, Kestra, workers, or unrelated services.
- Keep the preceding compatible release for immediate rollback.
- Run `scripts/verify.sh` and public HTTPS checks after every release.

## Rollback

The fast deployment script rolls back automatically when its local health checks
fail. Manual rollback remains:

```bash
RELEASE_ID=<known-good-release> scripts/rollback.sh
```

Application rollback does not undo database changes. That is why production
migrations must remain compatible with the preceding release.
