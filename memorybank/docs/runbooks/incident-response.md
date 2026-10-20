# Security incident response

The commitment this runbook makes true: the Privacy Policy (§16) says DonorDesk will notify affected customers "without undue delay where required by applicable law", and the DPA (§8) says "without undue delay (and aim for within 72 hours)" after becoming aware of a personal data breach affecting Customer Personal Data. This is how that happens, who does it, and what is recorded.

Channel for reports: `privacy@donordesk.online` (security reports and customer contact), `legal@donordesk.online` (contractual notices). Check that both mailboxes exist before relying on this (the code marks `privacyEmail` "TO CONFIRM").

## 1. Roles

| Role | Who | Does |
|---|---|---|
| Incident lead | The on-call operator (default: the platform owner) | Decides severity, owns the timeline, makes the notification call |
| Technical responder | Whoever holds `ssh contabo` | Contains, investigates, preserves evidence |
| Communications | The incident lead unless delegated | Writes and sends customer and regulator notices |

A team of one fills all three roles; write the decisions down anyway (section 6).

## 2. What counts, and how serious

Declare an incident for any suspected: unauthorised access to customer data or a customer account; loss or theft of a device or credential with access; a broken audit chain (`donordesk-audit-verify` fails); data of one organisation visible to another; a leaked secret (API key, `AUDIT_CHAIN_KEY`, `PLATFORM_MASTER_KEY`, `INTERNAL_TOKEN`, a Drive/OAuth token); ransomware or loss of the host; a provider (Anthropic, Z.ai, Google, MiniMax, Postmark, Creem) telling us of their own breach.

| Severity | Test | First response | Customer notice |
|---|---|---|---|
| **SEV1** | Customer personal data confirmed or likely exposed, altered or lost; cross-tenant exposure; compromised admin or host | Immediately; page the lead | Within 72 hours of awareness at the latest; earlier if it helps them act |
| **SEV2** | Security control failed or credential exposed, no evidence data was reached | Same day | Only if investigation shows customer data was reached (then it becomes SEV1) |
| **SEV3** | Attempted attack blocked; vulnerability reported, not exploited | Within 3 working days | None; thank the reporter |

When unsure between two levels, take the higher.

## 3. The first hour

1. **Write the time.** Awareness starts when anyone on the team reasonably believes an incident may have happened. Record it in the register (section 6): the 72-hour clock runs from here.
2. **Contain without destroying evidence.** Revoke the exposed credential (rotate per `key-rotation.md`); for a compromised user, suspend them (role change/suspension takes effect on their next request) and reset their password; for a suspected host compromise, take a backup first (`systemctl start donordesk-backup`), then isolate. Do not reboot or wipe before copying logs.
3. **Preserve.** Copy `journalctl` for `donordesk-api`, `donordesk-web`, `donordesk-workers`, nginx logs and the Postgres log for the window, to a location off the web tree. The tenant audit log is append-only and hash-chained: run `node dist/audit/verify-cli.js --all` (see `audit-verification.md`) and keep the output.
4. **Scope.** Which organisations, which data (accounts, evidence files, beneficiary data, report content), which period. Use the audit log (`AuditEvent`) and file access logs. Say "unknown" until shown otherwise; do not guess low.

## 4. Deciding to notify

Notify affected customers when personal data they are responsible for (as controller) was, or is reasonably likely to have been, accessed, disclosed, altered or lost, and the lead cannot show it was unreadable (for example, the evidence was encrypted and the key was not exposed). The customer decides about their own regulators and data subjects; our job is to give them what they need to do that on time.

Also notify: the sub-processor chain only as needed to contain; law-enforcement when the lead judges it useful; a regulator directly only where we are ourselves the controller (for example, our own account and billing data).

## 5. The notice

Send from `privacy@donordesk.online` to each affected organisation's administrator and contact address. Plain words, no jargon. Include: what happened and when; what data and which people it concerned (or "we are still establishing this"); what we have done; what we recommend they do; who to talk to; when we will update them next. If facts are incomplete, say so and send what is known; the DPA allows information to follow in phases. Never include another customer's name or data.

Template:

> Subject: Security incident affecting your DonorDesk workspace — [date]
>
> We are writing to tell you about a security incident that [may have] affected data in your DonorDesk workspace.
> **What happened:** …  **When:** … (we became aware on …)
> **What it involved:** …  **What it did not involve:** …
> **What we have done:** …  **What we suggest you do:** …
> We will write again by [date/time] with what we have learned. Contact: privacy@donordesk.online.

## 6. The breach register

Keep one row per incident, even when nothing was reached, in `memorybank/docs/security/breach-register.md` (create it on the first incident from the columns below). It is the evidence that the process ran.

| ID | Aware at (UTC) | Declared severity | What | Organisations / data | Contained at | Notified (who, when) | Regulators informed by customer? | Root cause | Fix | Closed |
|---|---|---|---|---|---|---|---|---|---|---|

## 7. After

Within 5 working days: a short written review (what happened, what worked, what did not, what changes), the register row closed, any fix shipped and tested, and the public `/security` page checked for any claim the incident showed to be untrue (correct it first, then explain).

## 8. Drill

Once a year, and after any change to this runbook, rehearse a SEV1 from step 1 to the notice, using a made-up incident: time how long the first notice takes to draft and send, and fix whatever was slow (a missing mailbox, an unknown contact). Record the drill in the register as "DRILL".

## 9. Alerts that start this

`donordesk-audit-verify` failing (`systemctl --failed`); `ai.spend_alert`, `job.dead_lettered` and `outbox.enqueue_failed` in the journal (operational, but check for abuse); `identity.user.locked` events in the audit log (repeated lockouts for one address suggest guessing); Prometheus rules in `infra/observability/alerts.yml` (availability and 5xx only). There is still no automated security alerting beyond these; the nightly audit verification and a weekly look at lockout events are the manual stand-ins.
