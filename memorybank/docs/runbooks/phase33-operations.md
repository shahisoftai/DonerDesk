# Runbook: Phase 33 operations

**DonorDesk Version 3.007** · Applies to the releases of 2026-10-27 and 2026-10-28. Facts about the host are in `../../contabo-ops.md` ("Phase 33 host facts").

## 1. Keys and secrets

| Secret | Where | Consequence of losing it |
|---|---|---|
| `CONNECTOR_SECRET_KEY` (32 random bytes, base64) | `/opt/donordesk/shared/api.env` | Every saved KoboToolbox / SurveyCTO key becomes unreadable. Users must re-enter keys. **Keep a copy outside the host.** A copy is in `~/donordesk-secrets/` on the operator's machine. |
| API keys and share-link tokens | Shown once to their creators | Only hashes are stored; a lost token is replaced, not recovered. |
| `api.env` (the file itself) | `/opt/donordesk/shared/api.env` | A dated backup is written beside the file before any edit (`api.env.bak-<date>`). |

To rotate `CONNECTOR_SECRET_KEY`, the old value must be used to decrypt and re-encrypt every connector credential first. **No rotation script exists yet.** Do not change the key without writing one.

## 2. Public routes and their limits

| Route | Limit | Notes |
|---|---|---|
| `/api/v1/*` (key required) | 10 r/s per key at nginx; 120 a minute per key in the API | `Retry-After` on 429. Limits in memory: a restart resets them. |
| `/api/v1/mcp` | same as above | POST only; GET answers 405. |
| `/api/collect/*` (collection link answers) | 5 r/s per address, burst 20 | Body limited to 128 KB. |
| `/shared/dashboard/*`, `/embed/dashboard/*` | 5 r/s per address, burst 20 | Each view reads the database. |
| `/field` | none | Renders no signed-in data; kept by the service worker. |

If a public route is abused, tighten its zone in `/etc/nginx/conf.d/donordesk-api-limit.conf` (copy changes into `infra/nginx/`), then `nginx -t && systemctl reload nginx`.

## 3. Ask DonorDesk

- Off in every organisation by default. An administrator switches it on in Settings → Ask DonorDesk. It needs AI switched on and a real provider.
- Each question is audited by length, status and sources, never by text.
- Caps: 60 questions an hour and 400 a day per organisation (rows in the LLM usage ledger, operation `ASK_DONORDESK`).
- Before switching it on for a real customer: run the golden question set and record the results (plan §5).

## 4. Two-step sign-in requirement

- Set per organisation in Settings → Security by an administrator who already has two-step sign-in on.
- From the chosen day, the API returns 403 `MFA_SETUP_REQUIRED` for every route except the two-step routes and sign-out. This is checked on every request.
- To lift it in an emergency, set `Organization.mfaRequiredFrom` to NULL in the database (migrator role) and record why in the audit log. Do not disable two-step sign-in for individuals outside this path.

## 5. Trials

- `TRIALS_ENABLED` is unset in production; sign-up grants no trial. Setting it to `1` is an owner decision (see `pending.md`).
- Trial-ending notices run from the hourly reminder timer in each organisation's morning run (`donordesk-reminders.timer`). They use the reminder ledger, so a repeat run sends nothing twice.

## 5a. Connectors (KoboToolbox, SurveyCTO)

- Requests go only to public https addresses, follow no redirects, time out after 25 seconds and read at most 8 MB.
- Five pages of 500 submissions per sync at most; a sync that stops early says "more waiting" and the button is pressed again.
- A submission the form refuses stops the cursor; fixing the mapping and syncing brings it in.
- If a sync fails with "refused the key", the key was revoked or lacks read access on the other tool. Edit the connector and enter a new key.

## 6. Languages

Web only. No server setting. If a translation is wrong, correct `apps/web/src/features/i18n/messages/<lang>.ts` and run `pnpm --filter @donordesk/web test:unit`; the completeness test shows what is missing.

## 7. Verification after any Phase 33 release

1. `curl -sI https://donordesk.online/login` → 200.
2. `curl -s -o /dev/null -w "%{http_code}" https://donordesk.online/api/v1/projects` → 401.
3. `curl -s -o /dev/null -w "%{http_code}" https://donordesk.online/api/v1/mcp` → 405.
4. Health: `/ready` returns `ok` for every check, including the new `/ready` pairs listed in AGENTS.md for each migration.
5. Journal: `journalctl -u donordesk-api --since "-5 min"` shows no errors.
