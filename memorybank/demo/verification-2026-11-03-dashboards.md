# Verification 2026-11-03: dashboards on production (Phase 39 and share links)

**DonorDesk Version 3.007** · test tenant (the user's own account `mnpiracha@gmail.com`, organisation GEC) on `donordesk.online` · driven from a visible Chromium window attached over CDP · credentials were given in the conversation and used through one environment variable; none are stored in any file.

Related: `../imp/phase39-enh-dashboards.md` §12, `AGENTS.md` → "Phase 39 invariants" and "Share links show maps and activity figures".

## 1. Before Phase 39 (production at release `20261028133938`)
- Baseline pictures of two existing dashboards, light and dark: `../imp/phase39-baseline/` (README lists what the pictures showed: duplicate titles, dark-mode chart text almost invisible, one flat blue, bright white gridlines, a toolbar that wrapped badly, a single-slice pie as a solid disc).
- New dashboard **"Phase 39 check - Nutrition"** made from the Nutrition template for the `[DEMO-9-ET]` project. Role suggestions matched four of five roles (the recovery-rate role was left empty, not guessed). Result: six tiles, **two of which could not draw** (a scatter: "needs two indicators"; a waterfall: "needs at least 2 values; there is 1") and showed the bare title "Chart".
- Edit mode: removed the two dead tiles, added a heading and a green number tile ("Planned activities", 37 activities), saved, reloaded: all persisted. Period filter, Download image (`Phase-39-check---Nutrition-<date>.png`), full screen and Pin to Home worked (pin then removed; the dashboard page's button label does not change after pinning).
- A share link opened from a signed-out context drew the indicator charts, but the number tile said "Not available here" and maps said "Maps are not shown through a share link".

## 2. After release `20261103044136` (Phase 39)
Single title per tile; dark-mode chart text readable; dashed gridlines; "View data" on every chart (opened a table: `OP2.1 Baseline 0 Target 4,000 Result (Nov 2026) 480`); **Low-data mode** turned three charts into tables and back; **Print** drew every chart before the dialog (stubbed `window.print` was called once); pin/unpin worked.
Found: the page scrolled sideways (page 1303 px in a 1081 px window) because the long project names in the two toolbar selects widened it; the caregivers chart lost the label of its "Target" bar on a narrow tile. Both were fixed in the next release.

## 3. After release `20261103054323` (instant drawing, share links, fixes)
- **Instant drawing**: a number tile added in edit mode (`In progress`, purple) showed its figure about one second later (`0 activities`), with no "Save the dashboard to draw this."; Cancel discarded it. A map added in edit mode drew itself (a canvas was present) before saving, and saving kept it (7 tiles became 8 after a reload).
- **Share link** (the same link, opened signed out): "Planned activities" showed **37 activities**; the Sudan activities map drew (`4 sites · 2 sites late · 2 sites on time`, with the not-placed list); the Sudan results map rendered with its indicator picker and the line "A fixed view for this link; the figures are as they stood when the page opened." (`0 of 0 places have a figure`: that demo has no province-level values). No page errors.
- Money tiles were not tested on a link (none on the test dashboard); the unit test shows `FIN_*` tiles stay "Not available here" and that the budget, finance and projects readers are never called for a link.

## 4. Left in the tenant (delete when no longer needed)
- Dashboard **"Phase 39 check - Nutrition"** (about eight tiles: four charts, a note, the "Planned activities" tile, "Sudan: where activities are", "Sudan: results by place").
- A share link on it labelled **"share-check"** (revoke it in the dashboard's "Share a read-only link" section). Its token is deliberately not recorded here.
- The test Chromium profile is in the scratchpad (`ddprof`); it holds the signed-in session and should be removed with the browser window.

## 5. Not verified
The visual pictures were not compared against the baselines on production (the harness uses its own stubbed page); the new FR/ES/AR labels were not read by a native speaker; money tiles on a link; password-protected links (not built); three maps that had been added earlier to the test dashboard were missing before the second deploy and the cause is unknown.
