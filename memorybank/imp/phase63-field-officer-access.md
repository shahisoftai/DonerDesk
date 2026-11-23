# Phase 63 — the field officer: least access, one mobile path (2026-11-23, branch `0025-place-tree`)

Trigger: a field officer assigned to the KP facility assessment could not find the form (it was only inside Project → Data → Forms), saw every
project page under "More", and the API served them finance, billing, results analysis and the full beneficiary list. Audit findings:
see the conversation of 2026-11-23; this file is the plan and the record of what was built.

## Principles (SOLID, applied)
- **Single responsibility.** One module decides each question: *who may see money / analysis* is two permissions (`finance.view`,
  `results.view`); *whose records may a person see or change* is one pure policy (`record-ownership.ts`); *which project pages a role may
  open* is one table (`ROLE_REACHABLE_PAGES`); *what a person can record* stays `RECORD_KINDS`.
- **Open/closed.** A restricted role is a row in `ROLE_REACHABLE_PAGES`; a role with no row is unrestricted, so nothing changes for the
  other roles and a new restricted role adds a row, not a branch. A new record kind or page is a row, never an `if (role === …)`.
- **Liskov.** Every role-dependent function takes a `Role` and answers for all of them through a table; no function special-cases
  `FIELD_OFFICER` by name outside the tables (pinned by a test).
- **Interface segregation.** The two new permissions are small and named for what they open; the guard, the navigation and the Record
  sheet each read only the table they need.
- **Dependency inversion.** Handlers depend on the pure policy and on `Permissions`, not on role names; the web reads `capabilities`
  that mirror the domain permissions.

## Batches
| Batch | What | Where |
|---|---|---|
| 63.0 | This plan, AGENTS.md invariants | `memorybank/imp`, `AGENTS.md` |
| 63.1 | Permissions `finance.view`, `results.view` (every role except FIELD_OFFICER); pure `record-ownership` policy; domain tests | `packages/domain` |
| 63.2 | API: route rules moved to the new permissions (finance, budget, funding, rates, billing summary, results analysis, portfolio, management report, logframe versions, data sheet, closing plan); finance import needs `finance.view` (the handler still needs `workplan.update-own`); changes-of-plan need `risk.manage`; beneficiaries list/edit/delete by ownership; **field-officer access test** that fails when a new route reaches a field officer without being listed | `apps/api`, `packages/application` |
| 63.3 | Web access: `ROLE_REACHABLE_PAGES` (field officer: Overview, Results framework, Work plan, Where we work, Forms, Datasets, Evidence, People reached); project nav hides the rest (no "More"); the project layout answers "not found" for an unreachable page; capabilities mirror | `apps/web` |
| 63.4 | Mobile path: the **Form** kind is offered to `collection.submit`; the header Record button shows for anyone with any record kind; field Home lists "Given to you" facilities and forms with one tap to fill; a "Work without signal" card links to `/field`; `/more` lists the field app | `apps/web` |
| 63.5 | Test, build, verify, deploy (`SCOPE=both`), live check with a field officer | — |

## Decisions
- Beneficiaries: a field officer sees, changes and removes **only the people they registered**; everyone else sees all (`results.view`).
- Financial *entry* on a plan item the person owns (draft expense) is kept: it is the field officer's job and the handler already scopes it.
- Not covered (named so nobody assumes): the generic `visual-data` query and dataset routes still answer by the source's own permission;
  Ask DonorDesk is not reachable from the field officer's pages but its API rule is unchanged.

## Verification
- Domain: `record-ownership.test.mjs`, permissions table test (every non-field role holds both new permissions; field officer holds neither).
- API: `field-officer-access.test.mjs` (every rule a field officer can reach is on an allow-list; no GET of money or analysis); the existing
  `authorization-coverage.test.mjs`.
- Web: `role-project-pages.test.mts` (reachability table, guard, nav), `record-kinds` test for the Form kind.
- Live: sign in as a field officer; project shows 5 tabs without "More"; finance and settings answer not found; Record opens the form.

## Phase 63b — the field officer sees only field work (2026-11-23, decided with the owner after a screen-by-screen check as a real field officer)
Check result: server lockdown worked, but Visual Studio, Reports, Compliance, Downloads, Where we work, Onboarding, Settings tabs, the results-framework
edit buttons, the project places control and two form tabs were still open or visible. Owner's decision: **a field officer is presented with the
forms to fill in for any project, a map of their places, and their list of activities; nothing else.**

| Batch | What |
|---|---|
| 63b.0 | This section |
| 63b.1 | Project pages for the field officer shrink to the work plan (list and map of their activities), forms, and the photo/file upload (`/evidence/new`); the project's front page sends them straight to their forms (or the work plan when the project has none): `ROLE_LANDING` table |
| 63b.2 | App-level reachability: one table (`ROLE_REACHABLE_APP_PAGES`) enforced in the portal layout; navigation entries for the role are Home, Inbox, Projects; every other top-level page answers "not found" (this also closes the redirects `/charts`, `/maps`, `/infographics` into `/visuals`) |
| 63b.3 | Form workspace shows its tabs by capability: Fill in for `collection.submit`; Facilities (coverage) for `project.edit`; Assessments (review) for `indicator.verify`; What it adds up to for `indicator.update` |
| 63b.4 | Work plan page hides "People reached" and the spreadsheet download when the role cannot reach/see them |
| 63b.5 | No permission names in messages: `Permissions.require` says "You do not have permission for this" (role and permission stay in the details for the log) |
| 63b.6 | Live screen check script `apps/web/tests/live/field-officer-screens.mjs` (credentials from the environment; fails when a restricted screen opens); unit tests; AGENTS.md; deploy `SCOPE=both` |

Decisions: "register people reached" and "enter indicator values" are **off** for the field role; making either a per-project switch is a later batch
(it needs a stored setting). The map is the work plan's own map view of the person's activities, not a new page.

## Status (2026-11-23): built, tested, deployed, checked live as a field officer
| Release | What |
|---|---|
| `20261123101758` (api) | The password-reset email now contains the reset link (`emailLink`, in the email only, never in the in-app inbox). `WEB_BASE_URL=https://donordesk.online` added to `/opt/donordesk/shared/api.env` (backup `api.env.bak-webbaseurl-<time>`); before it, links would have pointed at localhost. **The invitation email still carries no link** (the link is shown to the admin on the Team page): see pending. |
| `20261123111219` (both) | Phase 63: `finance.view`/`results.view`, record ownership, route rules, Record Form kind, Given to you, field-officer access test. |
| `20261123115213` (both) | Phase 63b: reachable pages and landing, app-level reachability, form tabs, no permission words. |
| `20261123120430` (web) | Found by the live check: `/where-we-work` and `/places` were not in the middleware matcher, so the gate saw no path. Matcher fixed, gate fails closed, new test. |
| `20261123121410` (web) | Found as the field officer: a Home link opened the form's list of all 37 facilities. Links now carry `?place=`, only the facilities given to the person are offered, and the chosen one opens at once. |

Live check as the field officer (Pasha, project `KPHF-HFA-2026`): 46 of 46 as expected (9 open, 36 closed, project front page lands on Forms). Test fixes: three older assertions were updated on purpose (field officer tabs, Form kind permission, Expense needs finance); a viewer now also holds the two read-only view capabilities.

Tools used: an SSH tunnel to the api (`ssh -N -L 14001:127.0.0.1:4001 contabo`) for API work, and a visible Chromium with remote debugging on 9334 for the live checks (connect with `127.0.0.1`, not `localhost`: `localhost` resolved to IPv6 and hung).

## Phase 63c — server-side deny-by-default, sensitive files, scoped download (2026-11-23)
Owner asked whether the field officer's access was set correctly on mobile. Honest review found three gaps (evidence search still open and Sensitive files readable through the API; the offline pack held every organisation place; many project-view reads only audited by hand) and untested ground (no real submission as a field officer, no direct API calls as one).

| Batch | What | Release |
|---|---|---|
| 63c.1 | `role-route-access` middleware + `FIELD_OFFICER` allow-list + audit/enforce switch + test (`apps/api/test/role-route-access.test.mjs`: open list, closed list, other roles unaffected, both modes) | `20261123164543` (audit) |
| 63c.2 | Sensitive evidence needs verify/override readers; `placeIdsWithAncestors` + pack places scope; tests updated on purpose (an older test checked the permission name in the error message: it now reads `details.permission`) | `20261123164543` |
| 63c.3 | Real end-to-end as a field officer (scratch project, throwaway account), audit log read, `GET /v1/places` added, project layout stops asking for datasets a role cannot open, mode set to enforce | `20261123170626` |

Result: e2e 25/25 and the screen check 46/46 against the enforcing server; throwaway account and scratch project removed. Pre-existing failing tests are unchanged (listed in `pending.md`).
Lessons: audit before enforce found what real pages call; a test that greps an error message for a permission name breaks when the message stops naming it (use `details`); never run `pkill -f`/`pgrep -f` with a string that appears in your own command line.
