# DonorDesk vs competitors: DonorDesk column verified against the code (2026-10-27)

Scope: DonorDesk only, checked against the schema, routes and invariants on branch `0014-maps`. Competitor cells from the earlier comparison are **not** verified here and must not be published without their own evidence (vendor docs, screenshots or a demo). No signed-in browser walk-through has been done: rows marked "UI unchecked" are code-level only.

Legend: Built = code present and, where noted, tested. Partial = some of the capability. Gap = not in the code.

## Corrections to the earlier comparison

| Capability | Earlier | Verified | Evidence |
|---|---|---|---|
| Geographic disaggregation | Gap | Built (UI unchecked) | `LOCATION` is a disaggregation dimension (`logframe/indicator-disaggregation.ts`); `reporting/location-analytics.ts`; `workplan/location-key.ts`. Missing: Data Center "By location" tab. |
| Maps | Not confirmed | Built | Phase 30: `site-map.ts`, bundled gazetteer, `TenantMapLayer` upload, plan Map view, Overview "Where we work". |
| Baselines, targets | Not confirmed | Built | `Indicator.baseline/target/targetBreakdownsJson/targetScheduleJson`. |
| Indicator formulas | Not confirmed | Gap | Derived percent of target, cumulative, variance, `aggregation` exist. No user-defined numerator/denominator formula. |
| Disaggregation (sex, age, etc.) | Not confirmed | Built | Five dimensions; `disaggregationRequired`; group targets. Cross-tabulation (age x sex): not confirmed. |
| Budget, expenditure | Not confirmed | Partial | `BudgetLine`, `BudgetExpense`, `PeriodFinancialSummary`; finance reaches reports only when verified and for quarterly-or-longer periods. |
| Workplans, milestones | Partial | Built | Phase 28: timeline, calendar, My week, dependencies, repeats, import, revisions. |
| Results framework | Partial | Built | `LogframeItem`, `LogframeVersion`, copy-setup, donor indicator mapping. |
| Portfolio | Partial | Built | `Programme`, `Grant`, portfolio overview, `countedElsewhere`. |
| Partner access | Partial | Built | `User.external`, named projects, `EXTERNAL_ALLOWED` routes. |
| Audit trail | Not confirmed | Built | Hash-chained `AuditEvent`, UPDATE/DELETE revoked, scheduled verification. |
| Notifications, reminders | Not confirmed | Built | Reminder planner, one summary per person, escalation at 7 days, email modes. |
| Automation rules | Partial | Partial | `ProjectAutomation` toggles with numeric settings; no rule builder. |
| SSO | Not confirmed | Built | OIDC (`AUTH_PROVIDER=oidc`) + SCIM (`/scim/v2/Users`). |
| MFA | Not listed | Built, but the public page denies it | `/v1/auth/mfa*` routes; live `/settings/security` offers "Set up two-step sign-in" (authenticator app). The public `/security` page still says MFA is "not currently required or available for tenant accounts". Enrolment itself was not exercised. |
| Offline | Not confirmed | Partial | IndexedDB outbox (activities, plan status). `public/sw.js` caches only `offline.html`; pages always fetch fresh. Opening the app offline is NOT built. |
| Imports | Partial | Built | `TextImportPanel`, Data Center import. |
| Dashboards | Partial | Built | Data Center pivots/charts, infographic studio. |
| Comments | Partial | Built | Comments on plan items, risks, tasks, report statements; mentions. |
| Branding | Not confirmed | Built | `OrganizationBranding`, `InfographicBrandKit`. |
| Interface languages | Not confirmed | Partial | Infographic labels en/fr/es/ar (RTL). No i18n library in `apps/web`; UI is English. |
| Public API / outbound webhooks | Not confirmed | Gap | Only inbound `/v1/webhooks/creem`. SCIM is the only integration surface. |
| Forms / surveys | Not confirmed | Gap | Indicator grid and activity form only. |
| Native mobile | Not confirmed | Gap | Responsive web + outbox. |
| Grounded project-data Q&A | Not confirmed | Gap | AI is report-writing only. |
| Self-hosting | Not confirmed | Gap | Single-host SaaS. |

## Differentiators to substantiate (code present, comparison to rivals not done)
Source-grounded drafting with number grounding (`grounding.py`, `number-grounding.ts`); claim verification against evidence and the officer's own records; donor-template extraction (`TocTemplateExtractor`); second-approver rule (`checkApprover`); `INTERNAL_REVIEW` exports; evidence ZIP pack; evidence confidentiality table; PII firewall on the AI path.

## Housekeeping found
- AGENTS.md says "a service worker for opening the app offline" is not built. Still true: `sw.js` only serves an offline page. No change needed.
- CORRECTION to the first draft of this file: `apps/web/src/app/security/page.tsx:55` does NOT say MFA is available for tenants (an earlier grep was truncated). It says MFA is for platform administrators only. The page, and AGENTS.md's matching sentence, understate the product and need updating once enrolment is confirmed to work end to end.

## Still to check in a signed-in browser
Location entry in the indicator grid and its effect on the by-location view; the map with a real project; MFA enrolment; `/security` copy as rendered; offline outbox behaviour.

## Browser verification (2026-10-27, demo tenant, project DEMO-12 Sudan MNCH, production)
- Login and dashboard: works. `/settings/security` shows "Two-step sign-in" with "Set up two-step sign-in" (not enrolled, to avoid changing the account).
- Location entry: the period indicator grid has a Breakdown panel per indicator with a dimension selector (Location, Sex, ...), free-text category, value, and a consistency line ("Location: 410 of 410", "Sex: 410 of 410"). Six Sudan localities were entered on a verified indicator. Built and usable.
- Maps: Activities > Map shows pins coloured by delivery signal ("4 sites, 4 on time"). Rabak, Sinja, Um Gargur and Singa (and "Six localities (all)") were listed as not placed: the bundled gazetteer misses small Sudanese localities; hand-placed pins are the workaround. Real, minor gap: widen the gazetteer or add a place-search fallback.
- Timeline: works (94 planned activities, repeats, grouped by logframe output).
- Overview: "Where we work" section is present.
- Data Center tabs: Indicator data, Charts, Finance, Import / export; views By period and List. There is **no By location view** (confirmed).
- Infographics: list shows two drafts, none published. Studio not exercised.
- Offline: with the network off, a project page shows "You are offline ... Nothing is cached on this device". Confirms the shell-only service worker: opening the app offline is not built.
- Not exercised: MFA enrolment, outbox queue while offline, infographic publish.
