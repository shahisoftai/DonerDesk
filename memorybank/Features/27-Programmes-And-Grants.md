# Feature 27: Programmes and grants — the funding hierarchy

**DonorDesk Version 2.006**

**Author:** Claude (agent) · **Date:** 2026-10-21
**Status:** Built, tested and deployed 2026-10-20 (batch 3, audit finding H-2; PM-01). Browser check pending. Builds on [Feature 04](04-Project-Setup.md).

## 1. What a user gets

| In plain words | Where it shows |
|---|---|
| A **programme** groups related awards and projects (a country programme, a thematic portfolio) | `/programmes` (also linked from the Projects list) |
| A **grant** is one award: title, donor, award number, amount and currency, dates, active or closed | `/programmes`, "New grant" |
| A project is placed **under a grant** (which brings its programme with it) or under a programme | Each unplaced project offers "Place under a grant…" |
| Totals per programme and per grant: how many projects (and how many active), project budgets and awards **by currency** | Each programme card |

Before this, the donor was free text on a project, so nothing could be added up across one donor's awards or one programme's projects. The donor name on a project is still free text; a grant makes the donor a record only when the grant is entered.

## 2. Rules that matter

- **Administrators only** create and change programmes and grants (`project.create`).
- **Programme names are unique** within the organisation (case-insensitive).
- **Amounts** must be positive numbers with two decimals at most, and need a three-letter currency code. Grant dates must not end before they start.
- **Totals never add currencies together**: USD and EUR are shown side by side. A project with no budget is not counted as zero.
- **Placement is written only through the funding repository** (`placeProject`). Editing a project never clears its placement.
- A **grant that belongs to a programme** puts the project in that programme. Choosing a grant from a different programme is refused.
- Totals cover the projects **the viewer may see** (the same visibility rule as the project list).
- Every change is audited (`programme.created`, `grant.updated`, `project.funding.placed`, …).

## 3. Where it lives

| Layer | Path |
|---|---|
| Domain | `packages/domain/src/contexts/funding/funding.ts` (validation, `summarizeFunding`) |
| Application | `use-cases/funding/funding-handlers.ts` (list, save programme, save grant, place project); `ports/projects.ts` (`IFundingRepository`) |
| Infrastructure | `repositories/funding.ts`; tables `Programme`, `Grant`, columns `Project.programmeId/grantId` (migration `20261021190000_programmes_and_grants`, forced RLS) |
| API | `GET /v1/funding`, `POST /v1/programmes`, `PUT /v1/programmes/:id`, `POST /v1/grants`, `PUT /v1/grants/:id`, `PUT /v1/projects/:projectId/funding` (`routes/org.ts`) |
| Web | `app/(portal)/programmes/page.tsx`, `features/funding/presentation/FundingManager.tsx`, `lib/actions/funding.ts` |

## 4. Limits

- No budget lines or expenditure against a grant yet (budget lines are a Phase 29 item).
- A grant does not yet carry reporting deadlines or donor-specific requirements; those are set per template or requirement pack ([Feature 30](30-Donor-Requirements.md)).
- Closing a programme or grant does not change its projects.
