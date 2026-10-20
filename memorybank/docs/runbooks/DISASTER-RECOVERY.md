# Runbook — Disaster recovery (backup, restore, host loss)

**DonorDesk Version 2.005**

What it covers: how the data is backed up, how it is restored, and what to do when the host is gone. The deployment is **one Contabo
host** (Ubuntu 24.04, HestiaCP + nginx, PostgreSQL 16 native cluster, local filesystem storage). There is no second region and no
replication: the backup is the recovery path.

> Superseded: an earlier version of this runbook described Aurora Global, Route 53, S3 CRR and kubectl. **None of that is deployed.**
> It was a future managed-cloud design, and following it at 3am would have wasted the incident. The AWS material is kept in
> `memorybank/architecture/multi-region.md` for the day the deployment changes.

## What is on the host, and where

| Piece | Where |
|---|---|
| Runtime tree | `/opt/donordesk/app/` (api, web, superadmin, packages) |
| Workers (AI Reporter) | `/opt/donordesk/workers/`, systemd `donordesk-workers` on `127.0.0.1:8092` |
| Kestra | `/opt/donordesk/kestra/`, systemd `donordesk-kestra` on `127.0.0.1:8093/8094` |
| Shared secrets (mode 0600) | `/opt/donordesk/shared/` — `api.env`, `backup.env` |
| Database | PostgreSQL 16, native cluster `16/main` on `:5432`, database `donordesk` (Kestra: `donordesk_kestra`) |
| Evidence storage | `/opt/donordesk/shared/storage` (local filesystem; Google Drive and R2 are per-tenant alternatives) |
| Public web | `donordesk.online` → nginx → `127.0.0.1:3002`; API on `127.0.0.1:4001`; SuperAdmin on `127.0.0.1:3012` |
| Host | `srv.gec5.com` (`109.123.248.253`) |

## Recovery objectives — what is actually true

| Measure | Value | Why |
|---|---|---|
| **RPO** | **24 hours** | The backup runs once a night (02:17 UTC). A host lost between runs loses up to a day of work. |
| **RTO** | **~1 hour** | Provision a host, restore the database and the storage, point the domain at it, start the services. |
| **Evidence loss window** | Same 24 hours | The evidence archive is in the same backup. |
| **Tested** | Monthly restore drill (below) | A backup that has never been restored is a hypothesis. |

These numbers are the honest ones for a single host. They are what `/terms` ("we provide regular backups") and the DPA
("deleted in the normal backup cycle") should be read against.

## The backup

| Piece | Where |
|---|---|
| Script | `/opt/donordesk/shared/bin/backup.sh` (from `scripts/backup.sh`; **not** shipped by `deploy-fast.sh`) |
| Units | `/etc/systemd/system/donordesk-backup.service` + `.timer` (from `infra/systemd/`), `OnCalendar=*-*-* 02:17:00`, `Persistent=true` |
| Configuration | `/opt/donordesk/shared/backup.env`, mode 0600, owned by root |
| What it takes | `pg_dump` of `donordesk` and `donordesk_kestra`, `tar` of the evidence storage, SHA-256 per file, GPG encryption |
| Rotation | `BACKUP_RETENTION_DAYS` (14) and `BACKUP_MIN_KEEP` (7) |
| Record | A row in `BackupRun` (status, size, checksum) — visible in the SuperAdmin overview |

`backup.env`:

```
BACKUP_DIR=/backup/donordesk
DONORDESK_DB_ADMIN_URL=postgresql://donordesk_migrator:...@localhost:5432/donordesk
STORAGE_ROOT=/opt/donordesk/shared/storage
ENC_KEY=<the passphrase>
OFFHOST_TARGET=donordesk@offhost:/backups/donordesk
```

**`ENC_KEY` is not optional.** The script refuses to write an unencrypted backup unless `ALLOW_UNENCRYPTED=1` is set explicitly, and
`OFFHOST_TARGET` is what makes the copy survive the loss of this host. A backup that stays on the machine it protects is not a backup.

### Install or reinstall

```bash
scp scripts/backup.sh contabo:/opt/donordesk/shared/bin/backup.sh          # mkdir -p /opt/donordesk/shared/bin first
scp scripts/restore-backup.sh contabo:/opt/donordesk/shared/bin/restore-backup.sh
scp infra/systemd/donordesk-backup.{service,timer} contabo:/etc/systemd/system/
ssh contabo 'chmod 0755 /opt/donordesk/shared/bin/{backup,restore-backup}.sh && systemctl daemon-reload && systemctl enable --now donordesk-backup.timer'
```

### Check it

```bash
ssh contabo 'systemctl list-timers donordesk-backup.timer; journalctl -u donordesk-backup -n 40 --no-pager'
ssh contabo 'ls -l /backup/donordesk | tail -5'          # the stamped directories
ssh contabo "sudo -u postgres psql donordesk -c 'SELECT id, status, \"sizeBytes\", \"restoreStatus\", \"restoreTestedAt\" FROM \"BackupRun\" ORDER BY \"startedAt\" DESC LIMIT 5'"
```

`status = SUCCEEDED` and a `restoreTestedAt` in the last month means the data is recoverable. `restoreTestedAt` is empty means it has
never been proven.

## The restore

`restore-backup.sh` restores into a **scratch** database by default, so a test never touches the live one.

```bash
# The drill (safe: restores into donordesk_restore_test and records the result)
ssh contabo '/opt/donordesk/shared/bin/restore-backup.sh /backup/donordesk/20261020T021700Z --record'

# A real restore onto a fresh host
ssh contabo '/opt/donordesk/shared/bin/restore-backup.sh /backup/donordesk/20261020T021700Z --target-db postgresql://donordesk_migrator:...@localhost:5432/donordesk'
```

It verifies the checksums, decrypts into a temporary directory (the backup on disk stays encrypted), restores the dump, counts the
tables, projects and evidence files, compares the restored storage file count with the archive, and — with `--record` — writes
`restoreTestedAt` and `restoreStatus` onto the backup run.

**The drill is the point.** Run it monthly, and after any change to the schema.

## Host loss: the whole recovery

The host is gone. Nothing is running. Do this:

1. **Provision a new host** with the same shape (6 vCPU, 12 GB RAM, 100 GB disk) and the same Ubuntu 24.04. Point `donordesk.online`
   at it in DNS (the domain is registered at Hestia; the TTL is short enough for a same-day cutover).
2. **Install the stack**: PostgreSQL 16, Node 22, Python 3.12, nginx, and the `donordesk` system user.
3. **Bring the secrets across**: `/opt/donordesk/shared/api.env` and `backup.env` from the off-host copy. They are mode 0600; keep them
   that way.
4. **Restore the database**:
   ```bash
   /opt/donordesk/shared/bin/restore-backup.sh /backup/donordesk/<stamp> --target-db "postgresql://donordesk_migrator:...@localhost:5432/donordesk"
   ```
   Then re-apply the policies and the vector column, and check the schema agrees:
   ```bash
   psql "postgresql://donordesk_migrator:...@localhost:5432/donordesk" -f infra/postgres/rls.sql
   psql "postgresql://donordesk_migrator:...@localhost:5432/donordesk" -f infra/postgres/pgvector.sql
   ./scripts/check-migration-drift.sh "postgresql://donordesk_migrator:...@localhost:5432/donordesk"
   ```
5. **Restore the evidence storage** into `/opt/donordesk/shared/storage` (the archive is in the backup; if the evidence was on Google
   Drive or R2 instead, it is still there and only the archive needs restoring).
6. **Deploy the application**: `scripts/deploy-fast.sh` builds and restarts `donordesk-api`, `donordesk-web`, `donordesk-superadmin` and
   `donordesk-workers`. The Prisma client is regenerated against the shipped schema.
7. **Verify**:
   ```bash
   curl -fsS https://donordesk.online/api/health
   curl -fsS https://donordesk.online/api/ready     # 200 means the Prisma client matches the schema
   journalctl -u donordesk-api -n 50 --no-pager
   ```
8. **Tell the customers** what was lost: the RPO is the age of the backup, so say that plainly rather than "nothing was lost".

## If only the database is damaged

Restore the database into a fresh name, check it, then swap:

```bash
psql "postgresql://donordesk_migrator:...@localhost:5432/postgres" -c "CREATE DATABASE donordesk_restored;"
/opt/donordesk/shared/bin/restore-backup.sh /backup/donordesk/<stamp> --target-db "postgresql://donordesk_migrator:...@localhost:5432/donordesk_restored"
# compare, then:
psql "postgresql://donordesk_migrator:...@localhost:5432/postgres" -c "ALTER DATABASE donordesk RENAME TO donordesk_broken;"
psql "postgresql://donordesk_migrator:...@localhost:5432/postgres" -c "ALTER DATABASE donordesk_restored RENAME TO donordesk;"
systemctl restart donordesk-api donordesk-workers
```

## Quarterly checklist

- [ ] A restore drill was run and recorded (`restoreTestedAt` is set on the newest backup run)
- [ ] The newest backup is **off-host** and its checksum was verified from the off-host copy
- [ ] `ENC_KEY` is in `backup.env` and the file is mode 0600
- [ ] `BACKUP_MIN_KEEP` backups are present and readable
- [ ] A new host was provisioned and the recovery steps above were walked through once
- [ ] The SuperAdmin overview shows no failed backup in the last month

## What this does not cover

- **A region-wide outage.** There is no second region to fail over to; the recovery is a new host.
- **Point-in-time recovery.** The backup is a nightly dump, so a mistake made during the day is recovered to the previous night's
  state, not to the minute it happened. The PostgreSQL WALs on the host are not archived.
- **Encryption key custody.** The passphrase in `backup.env` is the only copy; losing it makes the backups unreadable. Keep a copy in the
  organisation's password manager, not only on the host.

## Related

- `memorybank/contabo-ops.md` — the host, its services and the deploy procedure
- `memorybank/docs/runbooks/alerts.md` — what is monitored
- `memorybank/docs/runbooks/key-rotation.md` — rotating the audit chain and PII keys
- `scripts/backup.sh`, `scripts/restore-backup.sh` — the scripts themselves
- `memorybank/architecture/multi-region.md` — the future managed-cloud design (not deployed)
