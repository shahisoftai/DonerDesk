# Threat Model — Phase 1 baseline

## Assets
1. Tenant data (organization profile, projects, logframes, evidence, reports).
2. Beneficiary PII that may appear inside uploaded evidence.
3. AI cost / inference budget.
4. Audit trail immutability (donor compliance).

## Adversaries
- **External attacker**: SQL injection, XSS, broken auth.
- **Compromised NGO user**: exfiltrates data outside their tenant scope.
- **Rogue AI**: hallucinates claims, leaks PII to external services.

## Mitigations in place (Phase 1)
- All inputs validated at the route boundary via Zod (`@donordesk/contracts`).
- JWT (HS256) with issuer/audience claims; secrets in env.
- `TenantContext` threaded through every handler; every repository `findById`
  filters by `tenantId`.
- Audit log append-only with `prev_hash` deferred to Phase 2 (hash-chained WORM).
- Structured logging with PII redaction (`pino` redact paths).
- File URLs are short-lived presigned paths (currently local fs; S3 in prod).
- AI outputs are reviewable drafts only; human approval gate before export.

## Deferred to Phase 2/3
- Postgres RLS (Postgres RLS policy on every table).
- Hash-chain audit notarisation to S3 Object Lock.
- Microsoft Presidio PII firewall pre-LLM.
- Rate-limit per tenant via Redis token bucket.
- OPA policies for ABAC.
