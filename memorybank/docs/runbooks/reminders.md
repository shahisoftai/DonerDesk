# Runbook — Reminders (daily summaries and escalation)

**DonorDesk Version 2.005**

What it does: once a day, in each organisation's own morning (07:00 in `Organization.timeZone`), every person with open work gets **one**
summary (in-app note always; email only when their setting allows it), and a late item is escalated **once** after 7 days. Nothing is
sent on a quiet day. Design: `AGENTS.md` ("Reminders without setup"), `memorybank/Features/24-Programme-Management.md`.

## How it runs (production, installed 2026-10-18)

| Piece | Where |
|---|---|
| Script | `/opt/donordesk/shared/bin/run-reminders.sh` (from `scripts/run-reminders.sh`; **not** shipped by `deploy-fast.sh`) |
| Units | `/etc/systemd/system/donordesk-reminders.service` + `.timer` (from `infra/systemd/`), `OnCalendar=hourly`, `Persistent=true` |
| Call | one signed `POST /internal/reminders/run` per organisation (`INTERNAL_TOKEN` + HMAC over method, path, tenant, timestamp, body, from `/opt/donordesk/shared/api.env`) |
| Idempotency | `ReminderLedgerEntry` (one summary per person per local day; one escalation per item) |

The script lists organisations with `sudo -u postgres psql` (the app role cannot see across tenants), then calls the API for each; the API
decides whether it is that organisation's 07:00 hour. Calling it every hour for everyone is cheap.

## Install or reinstall

```bash
scp scripts/run-reminders.sh contabo:/opt/donordesk/shared/bin/run-reminders.sh   # mkdir -p /opt/donordesk/shared/bin first
scp infra/systemd/donordesk-reminders.{service,timer} contabo:/etc/systemd/system/
ssh contabo 'chmod 0755 /opt/donordesk/shared/bin/run-reminders.sh && systemctl daemon-reload && systemctl enable --now donordesk-reminders.timer'
```

## Check it

```bash
ssh contabo 'systemctl list-timers donordesk-reminders.timer; journalctl -u donordesk-reminders -n 30 --no-pager'
ssh contabo '/opt/donordesk/shared/bin/run-reminders.sh'          # one line per organisation: {"ran":false,...} outside 07:00
ssh contabo 'FORCE=true /opt/donordesk/shared/bin/run-reminders.sh'  # send now (the ledger still prevents a second summary the same day)
```

`{"ran":false,"summariesSent":0,...}` outside 07:00 is correct. A `FAILED` line names the organisation; read the API log
(`journalctl -u donordesk-api`) for the `/internal/reminders/run` request.

## People who get nothing

- Notification setting "never" (Notifications page): in-app note only, no email.
- "Only urgent": email only for urgent or late items.
- Organisation time zone wrong (Settings): the 07:00 hour is in that zone.
- No email provider configured: in-app notes still arrive; email is skipped without failing the run.

## After a host reboot

The timer is `enabled` and `Persistent`, so a run missed while the host was down is made up at boot (demo 9 saw an unexpected reboot on
2026-10-18 20:31; the timer, API and `/ready` came back without help).
