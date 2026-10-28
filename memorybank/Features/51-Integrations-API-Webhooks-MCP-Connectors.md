# Feature 51: Integrations — public API, webhooks, MCP and collection connectors

**DonorDesk Version 3.007 (Phase 33.7)**
**Status:** built and tested. API keys, the public API, webhooks and the nginx exposure are deployed (`releaseId=20261028030634`). The completion (six webhook events, per-key limits, MCP, KoboToolbox and SurveyCTO connectors) is deployed with `releaseId=20261028062717`. **The connectors have never been run against a real KoboToolbox or SurveyCTO server.**
**Rules:** `AGENTS.md` → "Phase 33 invariants" (33.7) and "Phase 33.7 completion".

## API keys and the public API

- A key is read-only, with scopes `projects:read`, `indicators:read`, `places:read`, and optionally a list of projects. It can expire or be revoked. The token is shown once; only its hash is stored.
- `https://donordesk.online/api/v1/…` serves the read-only API. The API has its own authentication and is not reached through a session. Refusals say only "not allowed". Finance is never served.
- Limits: 10 requests a second per key at the proxy, 120 a minute per key inside the API (`API_KEY_REQUESTS_PER_MINUTE`), held in memory.

## Webhooks

Six events, announced from the audit trail after the change is recorded: indicator value verified, evidence verified, activity accepted, report submitted (a submission copy was sealed), report approved, period locked. Payloads carry ids and a status only. Each request is signed (HMAC-SHA256 over timestamp and body), retried up to eight times, and the endpoint is switched off after ten failures in a row. Addresses must be public https (checked when saved and again at delivery).

## MCP server

`POST /api/v1/mcp` speaks the Model Context Protocol (JSON-RPC 2.0, tools only). Three read-only tools: list projects, indicator values for a project, results by place. The key's scopes decide which tools appear; every call is checked again. Finance is never included. Settings → Integrations shows the address.

## Collection connectors (KoboToolbox and SurveyCTO)

- Connect a published collection form to a survey in KoboToolbox or SurveyCTO. Map each survey field to a question.
- **Check the connection** reads and reports without saving. **Bring in new submissions** stores each as a record waiting for review, checked by the form's own rules. Pulling the same submission twice stores it once. A submission the form refuses is reported and the next sync retries it once the mapping is fixed.
- The key is encrypted (AES-256-GCM) with `CONNECTOR_SECRET_KEY` and never shown again. Without that key nothing can be saved.
- Calls to the other tool go only to public https addresses, follow no redirects, and are time- and size-limited.
- Photos, select-multiple and repeat-group questions are not brought in. Syncs are button-driven; there is no schedule.

## Not built

KoboToolbox form-structure import (mapping is typed by hand); scheduled syncs; per-key limits that survive a restart; public API pagination; the other webhook receivers' examples.
