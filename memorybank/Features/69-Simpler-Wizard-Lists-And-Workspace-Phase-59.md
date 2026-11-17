# 69 — Simpler wizard lists and a calmer workspace (Phase 59)

**DonerDesk Version 4.01.** Plan: [`../imp/phase59-simpler-wizard-and-workspace.md`](../imp/phase59-simpler-wizard-and-workspace.md). Invariants: `AGENTS.md` → "Phase 59 invariants". Deployed 2026-11-17 (`releaseId=20261117052426`, `SCOPE=web`).

## What a user sees
- **Wizard, Indicators and Work plan slides:** every indicator or planned activity is one closed row (name, key facts, and "Needs: owner, direction…" while something is missing). Click to open its options. *Expand all* / *Collapse all* above the list; the first row that needs something opens, a single new row opens, a bulk arrival opens nothing. Accept and Remove stay on the closed row.
- **Wizard, reused facts:** a box "Already given, used here" on Places (country), Indicators (team), Work plan (team, places, project dates) and Finance (currency), each with where it came from. It only shows; nothing is copied or overwritten.
- **Wizard, Start:** after documents were read, "What we found in your documents" (a line per area, *Confirm all N that are waiting*, *Go to the first step that needs you*).
- **Wizard, apply to all:** owner and direction (Indicators), lead (Work plan): pick once, *Fill N empty*; only empty rows change.
- **Wizard, Data entry:** a team of fewer than three people gets simple review as the starting answer when none was chosen, with a sentence saying so.
- **Project Overview:** a "Next:" line (the most pressing item of the Needs-you queue, or *Create period* when there is no period and the person may create one).
- **Project tabs by role:** the bar shows the role's tabs, the rest are under *More* at the end of the row; the tab you are on is always shown.
- **Remembered filters:** Projects and the two Evidence lists reopen with the last filters (per person, per device); a page number is never kept.
- **Empty pages:** Reports, Evidence (all and per project) and Compliance say why they are empty and offer one button (left out, never disabled, without the capability).

## Where it lives
`lib/shared/expand-state.ts`, `components/ui/ExpandableList.tsx`; `features/project-setup/pcw/domain/{row-summary,apply-all,carried-facts,found-summary,review-default}.ts` and presentation `{ApplyAll,CarriedFacts,FoundCard}.tsx`; copy `PCW_COPY.simple` (four languages); `features/projects/domain/{next-step,role-project-tabs}.ts` + `NextStepStrip`; `lib/shared/{remembered-choice,remembered-filters,empty-states}.ts`, `components/data/RememberFilters.tsx`, `components/feedback/EmptyStateFor.tsx`; `AuthContext.userId`.

## Tests
`tests/unit/phase59-{lists-and-memory,project-rules,wizard-rules}.test.mts` (18 cases); the whole web unit suite (1074) and the typecheck passed before the deploy.

## Not built
Apply to all outside the wizard; remembered choices on lists other than the three above; a signed-in browser check of the new screens (owed); native review of the French, Spanish and Arabic text.

## Support articles
`how-to-create-a-project`, `how-to-find-your-way-around`, `how-to-search-projects-and-evidence`; map note in `docs/support/ux-4000-map.md`.

## Deploy
Web only, no migration, no env, no API change.
