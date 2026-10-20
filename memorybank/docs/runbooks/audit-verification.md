# Audit chain verification

Every audit event is hash-chained per organisation (HMAC-SHA256 keyed by `AUDIT_CHAIN_KEY`). The application role can
insert audit rows but not update or delete them (`infra/postgres/rls.sql`), so a break in a chain means someone with
superuser access changed the table, or the chain key was changed.

## What runs

`donordesk-audit-verify.timer` runs `donordesk-audit-verify.service` nightly at 03:41 UTC. The service calls
`node dist/audit/verify-cli.js --all`, which prints one JSON line per organisation and a summary
(`{"checked":N,"broken":M}`) and exits 1 when any chain is broken. A failed run shows in `systemctl --failed`.

## Install (one time, on the host)

```bash
cp infra/systemd/donordesk-audit-verify.{service,timer} /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now donordesk-audit-verify.timer
systemctl start donordesk-audit-verify.service && journalctl -u donordesk-audit-verify -n 20
```

`deploy-fast.sh` does not install units. `api.env` must contain `DATABASE_ADMIN_URL` and `AUDIT_CHAIN_KEY`.

## When it fails

1. `journalctl -u donordesk-audit-verify` names the organisation and `brokenAt` (the first event whose hash or link
   does not match).
2. Do **not** repair the chain. Take a backup first (`donordesk-backup.service`), then compare the event and its
   neighbours with the last restore-tested backup.
3. If the key changed, restore the old `AUDIT_CHAIN_KEY`; the chain verifies again.
4. Treat a break with no key change as a security incident.
