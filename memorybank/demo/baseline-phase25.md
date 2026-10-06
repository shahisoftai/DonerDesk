# Phase 25 baseline (before the phase)

Measured on demos 4 and 5 (UI-driven runs on production). Demo 6 scores the same measures; any miss goes to a Phase 26 list.

| Measure | Demo 4 / 5 baseline | Phase 25 target |
|---|---|---|
| Sections written by the stub per generated report (first generation) | 1-2 of 8 in 4 of 6 reports (demo 5) | 0 silent; any stub labelled with its reason and a one-click retry |
| Reports needing a manual workaround to reach "approved" | 6 of 6 (demo 5) | 0 |
| Figure flags a user must decide with a note although the figure is verified-correct | 3-15 per report (demo 5) | <= 1 per report |
| Dead ends (no user action can proceed) | 3: final month, uncleareable flag, billing page | 0 |
| Checklist items needing a manual scan or bulk resolve for data-driven concerns | 4 (demo 4), 1 (demo 5) | 0 |
| Clicks/screens per month for the field + M&E routine | ~55 | -40% |
| Server-log reads needed to explain a failure | 3 | 0 |
| Raw ids, codes, internal scores in donor text or user copy | 2 | 0 |

Where each is addressed: see `memorybank/imp/phase25-demo-fixes.md` section 0. How to re-measure: `scripts/demo-ui/` (browser), `pnpm journey` (handlers), Settings -> AI usage (stubs and retries per run).
