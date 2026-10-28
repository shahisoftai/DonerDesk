# Feature 52: Trust — two-step sign-in required per organisation, trials and the readiness checklist

**DonorDesk Version 3.007 (Phase 33.12)**
**Status:** built and tested; deployed 2026-10-28 (`releaseId=20261028070000`). No organisation requires two-step sign-in yet. Local trials are **off in production**.
**Rules:** `AGENTS.md` → "Phase 33.12 invariants". Memo: `../imp/phase33-12-trust-and-commercial.md`.

## Two-step sign-in required per organisation

- An administrator can require two-step sign-in of everyone from a chosen day: now, in a week, in two weeks or in a month. Before the day, people are reminded on every page. From the day, a person without it can only set it up, and sign out. The check runs on every request, so a session opened earlier is held to it too.
- Outside partners are covered.
- An administrator must have two-step sign-in on for their own account before requiring it. While required, nobody can turn their own off.
- Under single sign-on, the identity provider owns this and the requirement is refused.

## Trials

- A free trial can be granted at sign-up only when the server sets `TRIALS_ENABLED=1`. **It is not set in production.**
- One trial per mailbox: `+tags` and, for Gmail, dots are ignored; trials recorded under the old rule still count.
- Administrators are told three days before a trial ends, within a day before, and once after it ends. Organisations that have subscribed are not told.
- Open decision: whether a company domain should be limited to a number of trials. Owner's decision.

## ISO/IEC 27001 readiness

Not certified and not in progress. The checklist of Annex A controls, with the gaps and the order of work, is in the memo. Do not describe the service as certified or as holding ISO 27001.

## Self-hosting

Recommendation in the memo: offer a dedicated hosted instance on request (Enterprise). Do not build customer self-hosting until there are about three requests. Decision pending.
