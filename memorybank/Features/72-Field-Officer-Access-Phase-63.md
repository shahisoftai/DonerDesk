# The field officer: least access, one mobile path (Phase 63 and 63b, Version 4.01)

**Status:** built, tested and deployed 2026-11-23 (releases `20261123111219`, `20261123115213`, `20261123120430`, `20261123121410`); checked live as a real field officer (46 of 46 screen checks). Plan and record: `imp/phase63-field-officer-access.md`. Rules: `AGENTS.md` (Phase 63 and 63b).

## Why
A field officer assigned to a facility assessment could not find the form (it was only inside Project → Data → Forms), saw every project page under "More", and the API still answered them finance, billing, results analysis and the whole beneficiary list. The owner's decision: **a field officer is presented with the forms to fill in, their activities (list and map) and the photo/file upload, nothing else.**

## What a field officer sees now
- **Sidebar:** Home, Inbox, Projects. On a phone the bar is Today, Record, Waiting, More.
- **Home:** **Given to you** lists the facilities (or places) assigned to them for a form, started ones first, then the earliest due day. One tap opens that facility's form directly (`?place=` in the address). A line under it points to the field app (`/field`) for working without signal.
- **A project:** opening it goes straight to its **Forms** (or the work plan when the project has no form). The tab bar shows **Plan** (Work plan) and **Data** (Forms) only, with no "More".
- **A form:** only the **Fill in** tab. They choose from the facilities given to them (never the whole list), with **Start** and **Not visited**. When everything is done the page says so. Facilities (coverage), Assessments (review), totals, sharing and connectors show only to people who manage or review the form.
- **Record:** **Something we did**, **A photo or file**, **A form**. No expense or number entry.
- **Everything else answers "Page not found":** Visual Studio, Reports, Compliance, Downloads, Where we work, Programmes, Portfolio, Settings (except their own sign-in and password page), Team, Audit, the Evidence library, starting a project, and the project's finance, settings, team, data, enter, reports, ask, changes of plan, management report, charts, maps, import, setup, templates, results framework, places, datasets and people reached.

## How it is built (one table or rule each; nothing branches on a role name)
| Concern | Where |
|---|---|
| Money and analysis permissions (`finance.view`, `results.view`, every role but the field officer) | `packages/domain/src/policies/permissions.ts`, mirrored in `apps/web/src/lib/shared/capabilities.ts`; route rules in `apps/api/src/middleware/authorization.ts` |
| Whose records a person sees or changes | `packages/domain/src/policies/record-ownership.ts` (`visibleRecords`, `canChangeRecord`); people reached use it |
| Project pages a role may open; where a project opens | `features/projects/domain/role-project-pages.ts` (`ROLE_REACHABLE_PAGES`, `ROLE_LANDING`); enforced in the project layout |
| Top-level pages a role may open | `features/navigation/domain/role-app-pages.ts` (`ROLE_REACHABLE_APP_PAGES`, `deny` wins); enforced in the portal layout; fails closed when the path is unknown |
| The path header the gates read | `apps/web/src/middleware.ts` matcher; `tests/unit/middleware-path-header.test.mts` fails when a portal route is missing from it |
| Form tabs | `features/collection/domain/form-tabs.ts` (`visibleFormTabs`) |
| Facilities offered to a person | `assessment-flow.ts` (`mustChooseFromAssigned`, `offerFacilities`) and `AssessmentFlow` (`initialPlaceId` opens the chosen one) |
| Given to you list | `features/collection/domain/my-assignments.ts`, `MyFacilitiesPanel` |
| Record kinds | `record-kinds.ts` (Form follows `collection.submit`; a kind may list `requires`, e.g. Expense needs `finance.view`) |
| Messages | `Permissions.require` says "You do not have permission for this" (role and permission stay in the log details) |

## Verification
- API guard: `apps/api/test/field-officer-access.test.mjs` (closed routes stay closed, other roles lose nothing, every write a field officer can reach is field work or listed personal workspace).
- Domain: `test/field-officer-access.test.mjs`. Web: `tests/unit/phase63-field-officer.test.mts`, `middleware-path-header.test.mts`.
- Live: `DD_PROJECT=<id> DD_CDP=http://127.0.0.1:9334 node apps/web/tests/live/field-officer-screens.mjs` (signed-in field officer; fails when a restricted screen opens, a work screen does not, or a permission word appears).

## Lessons
- **A gate that reads a header must be in the middleware matcher.** `/where-we-work` and `/places` were missing, so the gate saw no path and let the page through; the first live check as a real field officer found it. The gate now refuses a restricted role when no path is known, and a test lists every portal route against the matcher.
- **Test with a real account in the real app.** The unit tests were green while Visual Studio, Reports and four more screens were still open.
- **An email address belongs to one person in one organisation in practice**: sign-in takes only email and password and opens the first account it finds, so the same address in two organisations (a demo one and a live one) opened the wrong one.

## Not built (on purpose)
- "Register people reached" and "enter indicator values" for the field role are off; a per-project switch needs a stored setting.
- Native review of the new `assess.facility.allDone` wording in fr/es/ar/ur/ps.
- Pre-existing failing tests (unchanged by this phase): two API tests that need a local database, the external-access sample list (`entry-places`), a PCW copy test, a dashboard-template handler test.

## Phase 63c — the server agrees with the screens (2026-11-23, DEPLOYED `20261123164543` in audit mode, `20261123170626` enforcing)
The screens were right but the server still answered routes a field officer's pages never call. 63c closes that:
- **A deny-by-default route list per restricted role** (`apps/api/src/middleware/role-route-access.ts`, `ROLE_ROUTE_ALLOWLISTS`, one row: `FIELD_OFFICER`). A route not on the list answers 403 "This is not part of your work." Every other role is unrestricted by it. It runs after the permission table and the partner list. `ROLE_ROUTE_MODE=audit` (host env, `/opt/donordesk/shared/api.env`) logs `role-route-would-be-refused` and lets the request through; anything else enforces (the host is set to `enforce`). Audit first, then enforce: the audit run on real screens found one route to add (`GET /v1/places`, the place picker) and showed the rest were correct refusals.
- **Closed even though the page is closed**: evidence search and library, canvases, charts, dashboards, datasets, visual-data, form totals/assignments/template, kits, the organisation map, framework, members, setup, finance and budget item routes, import and parse-file routes, inline place creation.
- **Sensitive evidence**: `CONFIDENTIALITY_READERS.SENSITIVE` is now `evidence.verify` or `report.override-confidentiality` (it was `evidence.upload`, which a field officer holds). A field officer opens Public and Internal files and their own uploads.
- **The offline download is scoped**: a person without `results.view` carries their assigned facilities, the places the project's plan and areas name, their planned items' places, and the areas above them (`placeIdsWithAncestors`), not the whole organisation's list.
- **Proven as a real field officer on production** with a throwaway account and scratch project (`apps/api/test/live/field-officer-e2e.mjs`): 25 of 25 checks (the work: project list, form, assignment, the 1-of-62 download, draft, photo, record, facility done; the closed routes all 403). `KEEP=1` leaves a sandbox for a browser run and prints it; `TEARDOWN=<json>` removes it. The screen check passed 46 of 46 against the enforcing server.
- Four archived scratch projects (`ZZ-FO-…`) remain in the AGRC tenant from these runs; they are test data and can be deleted.
- Not done: a real phone and real loss of signal (the checks ran in a phone-width desktop browser against the live API); a draft project shows its "activate" banner to a field officer (the KP project is active, so it does not appear).
