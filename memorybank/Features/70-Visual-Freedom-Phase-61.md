# 70 — Visual freedom: free pages, data first, every chart kind, editable text, enforced themes, Drive pictures, numbers on charts (Phase 61)

**DonorDesk Version 4.01.** Plan: [`../imp/phase61-visual-freedom.md`](../imp/phase61-visual-freedom.md). Invariants: `AGENTS.md` → "Phase 61 invariants". Deployed 2026-11-17/18 (`20261117190000`, `…203000`, `…221500`, `…233000`, `20261118010000`), no migration, no env. Support article: `/support/getting-started/dashboards-and-infographics`.

## What a user sees
- **New**: eight standard starters first, "More templates" (search) for the other ~150, **Page size**, **Look of the blocks** (default flat title bar). A blank page starts with the project's data listed in the **Add** drawer. A starter's indicator roles are suggestions, not requirements.
- **Free placement**: drag, eight resize handles, rotate, snap guides, arrow keys, typed X/Y/W/H/Turn, stacking order; any size from 24 px up; the page grows to hold what is on it; a stack under 640 px.
- **Chart kinds**: all drawable kinds in the picker; a kind the data cannot show reshapes the data and says so; a refused kind gives the reason (a pie never shows a rate).
- **Numbers on charts**: show, what (figure / share / name / both), number format, position, size; value labels reach every kind that can carry a figure.
- **Words and type**: every automatic headline/subtitle/caption/source/as-of line can be replaced and reset; text wraps, never truncates; font, size, weight, case, spacing per block.
- **Themes**: a chosen Look reaches every block (screen and files); blocks with their own colours are listed and can be reset.
- **Flat title bar** frame styles (the DevResults look) alongside the older frames.
- **Pictures**: upload (PNG, JPEG, WebP, SVG) to the organisation's Google Drive; a share link shows the pictures its canvas uses.

## Where it lives
- Domain: `packages/domain/src/contexts/canvas/` (`edit/free-edit.ts`, `pages.ts`, `text/text.ts`, `theme-kit/conformance.ts`, `theme-kit/frame-styles.ts`, `format/*`, `to-widgets.ts` `specWithFormatLabels`, `governance.ts`), `contexts/reporting/chart-reshape.ts`, `chart-value-labels.ts`.
- Web: `features/canvas/presentation/FreePageView.tsx`, `FrameFields.tsx`, `PageLayoutPanel.tsx`, `NewVisualForm.tsx`, `asset-url-context.tsx`, `editor/presentation/{DataPanel,ChartKindField,ChartLabelsField,MediaField,AddDrawer}.tsx`.
- Server: `GoogleDriveMediaStore` / `DriveRoutingStorage` (`storage/google-drive-media.ts`), `SharpImageNormalizer` (SVG checked and drawn to PNG), `GetPublicCanvasAssetHandler` + `GET /public/canvases/:token/assets/:assetId`.

## Known limits
Downloads (PNG/PDF/PPTX) stay one column in reading order, so free positions are approximated; population pyramid is planned (breakdowns are recorded one dimension at a time); gauges/rings/waffle/box plot/radar and similar do not take value labels; translations are drafts; the picture on a share link was confirmed from the server log (200), not by eye.
