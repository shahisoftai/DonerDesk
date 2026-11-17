# Phase 59 — simpler wizard lists and a calmer workspace (2026-11-17, branch `0025-place-tree`)

**Status: all batches built, tested (typecheck, web unit suite 1074/1074) and DEPLOYED 2026-11-17 (`20261117052426`, web only). Owed: a signed-in browser check; native review of the new FR/ES/AR text.** Deviations from the plan: apply to all is wizard-only; remembered choices cover Projects and Evidence filters only; `useRememberedChoice` was dropped (`RememberFilters` covers it).

Agreed scope (owner, 2026-11-17). Nothing else is in this phase. Places stays at step 5; no "fewer slides", no "launch later", no progress line, no table editing; collapsing applies to wizard Step 4 and Step 6 only.

## Changes
| # | Change | Where |
|---|--------|-------|
| W3a | Collapsible items on Step 4 (Indicators) | wizard |
| W3b | Collapsible items on Step 6 (Work plan) | wizard |
| W1 | Ask each fact once: reused facts shown with where they came from | wizard |
| W2 | Document path first: "here is what we found, confirm" | wizard Start |
| S1 | "What's next" strip at the top of the project Overview | workspace |
| S2 | Remember last-used choices (per device) on list filters | workspace |
| S3 | Plain-language empty states, one button | workspace |
| S4 | Project tabs trimmed per role | workspace |
| S5 | "Apply to all" on repeated per-item choices | wizard + workspace |
| S6 | Simple review chosen automatically for teams under three | wizard |

## Design by SOLID (one table per variation, no branching on a name)
- **S — single responsibility.** Pure rules live in `domain` files of one job each (`expand-state`, `indicator-summary`, `plan-summary`, `carried-facts`, `found-summary`, `next-step`, `remembered-choice`, `role-project-tabs`, `review-default`, `apply-all`). Components only draw and forward events; none decides a rule.
- **O — open/closed.** A new list that should collapse passes `ExpandableList` its items (summary, attention flag, body). A new empty state is a row in `EMPTY_STATES`. A role's tabs are a row in `ROLE_PROJECT_TABS`. A new "apply to all" field is a row in `APPLY_ALL_FIELDS`. A new carried fact is a row in `CARRIED_FACTS`.
- **L — Liskov.** `ExpandableList` items are one shape (`ExpandableItem`); both slides pass it and the component never learns which slide it is in.
- **I — interface segregation.** `ExpandableList` takes only `items`, `labels`, `autoOpen`; `RememberFilters` only a scope, a person and the list address; the next-step rule takes a small input type, not the whole overview.
- **D — dependency inversion.** Rules take their input as arguments (today, team size, capability set); storage goes through the small `ChoiceStore` interface (localStorage adapter, in-memory fake in tests); no rule imports React, the clock or the network.

## Rules fixed in advance
1. **Collapsing never hides a requirement.** Every row shows a summary and, for an incomplete row, a "needs …" chip naming the missing parts. Rows start closed; the first incomplete row opens (`MAX_AUTO_OPEN = 1`), so a document that fills every row does not open a hundred cards. A row the person just added opens. Expand all / Collapse all are always offered above two rows.
2. **A fact is carried, not copied silently.** `carriedFacts(view, slide)` returns `{ label, value, from }` rows; the slide shows "From Start: Kenya". The person can change the value at its source. Nothing is overwritten.
3. **Document path.** When the draft has documents and reading finished, Start shows a "What we found" card: counts per area from the draft, a button to confirm everything that is waiting (the existing `ACCEPT_MANY`) and a button to open the first slide that still has an open requirement. Nothing is accepted without that click.
4. **What's next** is derived from `needsYouItems` (first item) or, when nothing waits, the project's setup gap; one sentence and one link. It reads, never writes.
5. **Remembered choices** are per device, per key, validated on read (an unknown value is ignored), wrapped in try/catch, and never remembered for another person's session (key carries the user id).
6. **Empty states** say why the page is empty (a fact the page knows) and offer one button the person may use (hidden, not disabled, when the capability is missing).
7. **Role tabs.** `ROLE_PROJECT_TABS` names the tab keys a role sees in the bar; any other tab sits under "More". A page is never made unreachable: the command palette and direct links still work.
8. **Apply to all** fills only empty values, says how many it filled, and never overwrites a person's choice (same rule as "Use suggested settings for all").
9. **Review default.** A team of fewer than three people gets simple review as the draft's value when none was chosen, with a visible sentence and the select to change it. It writes only an unset answer.

## Batches
1. **B1 shared blocks**: `expand-state`, `ExpandableList`, `remembered-choice`, `EmptyState`.
2. **B2 wizard lists**: `indicator-summary`, `plan-summary`, Step 4 and Step 6 on `ExpandableList`.
3. **B3 wizard facts and documents**: `carried-facts`, `CarriedFacts`, `found-summary`, `FoundCard`, `review-default`, `apply-all` (owner, direction, lead).
4. **B4 workspace**: `next-step` + strip, `role-project-tabs`, remembered filters, empty states on pages that lacked one.
5. **B5 copy**: English source plus French, Spanish, Arabic drafts (typed, so a missing key does not compile).
6. **B6 tests**: unit tests per pure rule; run once after all batches.
7. **B7 deploy**: `SCOPE=web` (no API change), then a signed-in check on production.

## Not changing
No migration, no env, no API route, no write path. Everything uses the existing wizard actions.
