# Public API keys and outbound webhooks: first-version design (proposal, not built)

Status: proposal 2026-10-27. Nothing implemented. Needs a decision on scope before work starts.

## Goal
Let an organisation read its project data and receive events in other systems, without opening the whole internal API.

## Constraints from existing invariants
- Every authenticated route needs a `RULES` entry (`middleware/authorization.ts`); a key-authenticated route is no exception, and `authorization-coverage.test.mjs` must stay green.
- Partners are `User.external` with an allowlist (`EXTERNAL_ALLOWED`); a key must not become a way around project membership (`project-boundary.ts`).
- Tokens: store only the SHA-256 (as `ScimCredential` and `InfographicShareLink` do); show once.
- New tenant models need RLS entries (`rls-coverage.test.mjs`); events must be written with audit rows.
- Writers never receive any of this.

## Version 1 scope
### API keys
- Model `ApiKey { id, tenantId, name, tokenHash, prefix, scopes[], projectIds[], createdById, expiresAt, lastUsedAt, revokedAt }`. Admin (`org.manage`) creates and revokes; audited.
- Auth: `Authorization: Bearer dd_live_...` resolved on the admin connection by hash (like SCIM), then scoped by explicit tenant filter and RLS session. A key acts as a synthetic read-only principal limited to its `projectIds`.
- Scopes v1, read only: `projects:read`, `indicators:read`, `periods:read`, `activities:read`, `reports:read` (approved only).
- Surface: a separate prefix `/api/v1/...` mapping to existing read handlers (no new business logic), rate limited per key, with its own allowlist table modeled on `EXTERNAL_ALLOWED` and a coverage test.
- No write scopes in v1. Indicator value push comes with the forms work.

### Outbound webhooks
- Models `WebhookEndpoint { url, secretHash/encryptedSecret, events[], enabled }` and `WebhookDelivery { eventId, endpointId, status, attempts, nextAttemptAt, responseCode }`.
- Events v1: `report.approved`, `report.submitted`, `period.locked`, `indicator.value.verified`, `evidence.verified`, `activity.accepted`.
- Delivery through the existing `JobOutbox` / `JobRetryRunner` pattern; HMAC-SHA256 signature header with timestamp; exponential retry, disable after repeated failure; deliveries listed in settings with a "send test" button.
- Payload is ids and status only, never narrative text or restricted evidence; the receiver fetches details with its key.
- SSRF controls: HTTPS only, resolve and refuse private/link-local addresses, no redirects, short timeout.

## Not in v1
Write scopes, OAuth apps, GraphQL, per-field filtering, a Zapier connector.

## Tests required
Key hashing and one-time display; revoked/expired refused; project-scope boundary (denied = not found); allowlist coverage; RLS coverage; signature verification vector; SSRF refusals; retry and disable behaviour.

## Open decisions
1. Which events do pilot customers actually need? Ask before building more than three.
2. Is read-only enough for the first customers, or is value push required at launch?
3. Rate limits and plan gating (billing entitlement vs all plans).
