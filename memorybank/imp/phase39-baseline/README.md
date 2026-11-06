# Phase 39.0 baseline (2026-11-02)

Captured from production (`donordesk.online`, the user's signed-in Chrome on CDP port 9340, read-only) **before** any Phase 39 change was deployed.
Files: `dashboard-1-light.png`, `dashboard-1-dark.png` (Nutrition: screening and treatment, 6 charts), `dashboard-2-light.png`, `dashboard-2-dark.png` ("2", 5 charts).
Dark was shown by toggling the page's `dark` class and putting it back; the window was left open.

## Seen on screen (confirms the audit)

| Finding | Evidence |
|---|---|
| B: charts ignore dark mode | Dark: the in-chart title ("Progress against targets", "Children screened"…) is dark grey on dark, almost invisible; pie legend text has a white outline; gridlines are bright white and heavy |
| C: title drawn twice | Every chart shows its title in the header and again inside the chart; in dashboard 2 the inner title is clipped ("/S-OC1c …") |
| A/E: default look | One saturated blue for every bar, not the `--viz-*` tokens; default ECharts grid, no rounding, no direct labels |
| D/F: layout and header | Dashboard 2's page header wraps its buttons into three rows beside a bare title "2"; project label is truncated in every tile header |
| G: pie | The status pie is a solid disc with one slice and a legend; no value labels |
| Gantt | Grey bars with red late items on white; not themed |

## New findings the code read missed
- Page header controls (period, Pin, Show on Home, Full screen, Print, Download) wrap badly when the title is short.
- A one-point line chart ("Children screened") shows a single tiny dot with a full empty grid; it should say "one period so far" or draw a bar.
- The dark page background has a visible gradient patch on the left that stops at 900 px (the sidebar glow), cut off on tall pages.

## After
Batch 39.1 re-shoots these four screens from the new build and replaces nothing here; add `after-*` files beside them.
