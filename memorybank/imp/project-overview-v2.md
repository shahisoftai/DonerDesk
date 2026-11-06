# Project Overview v2 — role-aware management console

**Status:** implemented (web only, read-only)
**Mock:** `design-mocks/project-overview.html` (approved design; `design-mocks/project-overview-preview.png`)
**Replaces:** the reporting-first Overview at `apps/web/src/app/(portal)/projects/[id]/page.tsx`

## Why

The old Overview was designed for reporting only. By Phase 28 the app had a work plan, delivery
health, budget and spend, people reached, activity review, evidence review, requests, team workload,
risks and a decision log — all bolted onto one page as a stack of unrelated cards, and all visible to
every role. A Programme Manager ran the programme from five different screens; a field officer saw a
page full of things that were not theirs.

The new Overview is **one page composed of sections**, where each section answers one question and is
shown only to the roles that need it.

## The questions each section answers

| Section | Question | Data (all existing endpoints) |
|---|---|---|
| Lifecycle strip | Where are we in the project's life? | project start/end, periods |
| Needs you | What waits on my decision? | `/v1/me/assignments`, periods, risks |
| Pulse | How does the programme stand today? | `/delivery-health`, data-sheet, periods, beneficiaries, checklist |
| Calendar | What is due, and when? | work plan, periods, risks, my assignments |
| Reporting | Where does reporting stand? | periods, `/readiness`, checklist |
| Delivery | Is the plan matching reality? | `/work-plan`, logframe, data-sheet |
| Results & money | Will we deliver, will the money last? | data-sheet (indicators + finance) |
| Team | Who is carrying what, who needs help? | `/team-work`, project people, my assignments |
| Risks & decisions | What is going wrong, what was decided? | `/risks` (existing `RisksCard`, `DecisionLog`) |
| Close-out | What will closing the project need? | `/closing-report/plan`, data-sheet, periods |
| Setup | What definitions does the report draw on? | logframe, project detail |

## SOLID, concretely

- **S**ingle responsibility — `overview-sections.ts` decides *which* sections appear;
  `overview-derive.ts` computes *what* they say; `overview-read-model.ts` fetches; the components
  render. No file does two jobs.
- **O**pen/closed — a new section is one key, one table row, one component. A new role is one row in
  `OVERVIEW_ROLE_SECTIONS`; the exhaustive test fails until it is filled, so nobody can forget a role.
- **L**iskov — every section loader returns the same `SectionData<T>` (`{ ok: true, value }` or
  `{ ok: false }`), so a failing widget shows "unavailable" and never breaks the page. Every section
  component renders with empty data instead of throwing.
- **I**nterface segregation — a section consumes only the fields it needs (narrow props), and
  `sectionsFor()` returns only keys, never a fat object every section must satisfy.
- **D**ependency inversion — presentation depends on pure domain types and loader results, never on
  `gatewayRequest`; the pure modules import nothing from React, Next or the API.

## Rules the implementation must not break

- **A missing value is never 0.** Pace counts only recorded values; an indicator that was never
  measured is absent, never "0%".
- **A rate has no "% of target".** Rate indicators are excluded from pace counting (they show
  baseline/target/latest instead).
- **No invented scores.** Pace is a *juxtaposition* (share reached beside the share of time elapsed)
  and a count ("2 of 4 measured indicators are behind the clock") — never a fused score, never a
  projection. A projection would be a new domain rule; it is not introduced here.
- **A role sees only its own sections.** Hidden, never disabled. Gating is one table plus
  `SECTION_CAPABILITY`, the same shape as `ROLE_SURFACES` / `BUTTON_CAPABILITY`.
- **The project without a plan looks as before.** Delivery and the plan parts of the calendar hide
  when there is no plan or planning is hidden.
- **Writers never see this.** Nothing here reaches a report writer; risks stay out of the writer path.
- **No new writes.** Every action on this page is a deep link into the surface that owns the work.
  No new mutation, no new audit event, no new endpoint.

## Role matrix

| Section | ADMIN | PROJECT_MANAGER | ME_OFFICER | GRANTS_OFFICER | COMPLIANCE_OFFICER | FIELD_OFFICER | VIEWER |
|---|---|---|---|---|---|---|---|
| Needs you | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (own) | — |
| Pulse | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Reporting | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Delivery | ✓ | ✓ | ✓ | — | — | ✓ | — |
| Results & money | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Team | ✓ | ✓ | ✓ | — | — | — | — |
| Risks & decisions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Close-out | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Setup | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |

Plus: `TEAM` needs `team.view-work`, `CLOSEOUT` needs `project.edit`; `REPORTING` needs a reporting
period; `DELIVERY` needs a plan and visible planning; `RISKS` follows the existing rule (shown when
there is a plan, a risk, or the person may raise one).

## Deployment

No migration, no new environment, no API change. Web only (`SCOPE=web`).
`/ready` needs no new Prisma fields.
