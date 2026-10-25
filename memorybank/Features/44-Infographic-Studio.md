# Feature 44: Infographic Studio — designed results pictures from the project's own records

**DonorDesk Version 2.008 (Phase 31 + Phase 32)**

**Author:** Claude (agent) · **Date:** 2026-10-25
**Status:** Phase 31 (infographics and location disaggregation) DEPLOYED 2026-10-25 (`releaseId=20261025043802`). Phase 32 (Studio) DEPLOYED 2026-10-25 (`releaseId=20261025113046`, migration `20261027090000_infographic_studio_v2`, RLS applied to the four new tables). **Not yet checked signed-in in a browser**; the code is uncommitted on branch `0014-maps` at the time of writing. Plan: [`../imp/phase32-infographic-studio.md`](../imp/phase32-infographic-studio.md) (§7 = state, deploy steps). Invariants: `AGENTS.md` → "Phase 31 invariants" and "Phase 32 invariants".

## 1. What a person gets

| Piece | In plain words | Where it shows |
|---|---|---|
| Designs | A one-page (or multi-page) results picture built from blocks: headline, key figures, charts, locations, a who-does-what-where table, a timeline, a funnel, a map, key messages, notes | Project → **Infographics** (list); Portfolio → **Infographics** for roll-ups |
| 22 templates | Starting points by use: humanitarian snapshot, response at a glance, funding snapshot, coverage by location, beneficiary profile, flash update, donor one-pager, annual poster, factsheet, social and story cards, slide summary, results chain, sector dashboard, operational presence, and six results and closure layouts | "New infographic" → template |
| 9 page formats | A4 portrait and landscape, A3 portrait and landscape, square 1:1, portrait 4:5, story 9:16, slide 16:9, web banner 3:1 | Design panel |
| Themes | Five built-in themes (including a high-contrast and a greyscale-safe print theme) plus the organisation's brand theme | Design panel |
| Languages | English, French, Spanish, Arabic (Arabic is right-to-left; maps and charts are not mirrored) | Design panel |
| Studio | Live preview drawn by the same code as the published file; drag blocks, undo and redo, click a block on the page to edit it | Studio |
| Design check | A plain-language list of what to fix before publishing, each linked to the block it concerns; a finding can be waived with a note | Studio → **Check** tab |
| Wording suggestions | Headlines and key messages built from recorded figures only; optional AI draft, checked against the records | Studio → suggestions panel |
| Who does what, where | A matrix of organisations, their activity and places; can be drafted from the work plan (lead, activity title, place) | "Who does what, where" block |
| Images and logos | Image library, logos, brand kit (colours, logos, footer text, acknowledgement lines) | Studio → Pictures; Settings → brand kit (administrators) |
| Saved layouts | A layout can be saved for reuse; user templates are organisation-private | Studio → **Save this layout for reuse** |
| Review and approval | Draft → in review → approved; a person cannot approve a design they asked to have reviewed when another approver exists | Studio → Publish panel |
| Publishing | Exports: PNG (scale choice), PDF, SVG, PowerPoint and a ZIP pack (PNG sizes, PDF, alt text, caption, sources) | Studio → Publish panel → **Publish** |
| Public links | An expiring read-only link to one published file (1 to 90 days, default 30), revocable; the link never shows the design, only the file | Publish panel → **Make a public link** |
| Variants | One design, one draft per location or per period, from the same design | Studio → variants |
| Report insertion | A published picture placed in a report section as a snapshot (same draft and approval rules as Data Center charts) | Report editor → inspector → **Infographics** |

## 2. Rules that matter

- **One render path.** The preview and every export are drawn by the same composer (`packages/infrastructure/src/infographics/composer.ts`). No browser is used; PNG is drawn with `@resvg/resvg-js`, PDF with `svg-to-pdfkit`, with bundled fonts (Liberation Sans, Noto Sans Arabic) so output is the same on every machine.
- **Missing is never zero.** A block with no reported data says "Not yet reported" or "Not measured"; a rate has no "% of target". Test-pinned.
- **Config stores design, never data.** A design (`ProjectInfographic.configJson`) holds only layout and text. Figures come from the records at render time. Published exports (`InfographicExport`) are immutable: the rendered file, the exact inputs (`snapshotJson`) and a provenance footer. Regenerating makes a new export.
- **Design check is domain code** (`packages/domain/src/contexts/infographics/lint.ts`), one table, one test row per rule. The Studio and the publish gate call the same function. A blocker stops publishing; a warning does not, and a waiver needs a note.
- **Wording suggestions are grounded.** The fixed-pattern suggestions use only figures in the project's records. The optional AI draft (`ai-text.ts`) is redacted before it is sent, its reply is parsed strictly, and any sentence stating a figure the records do not hold is dropped. Its output is labelled "AI-drafted, not yet reviewed" and is never saved on its own.
- **Who does what, where** is authored, not derived. The draft from the work plan skips activities with no lead or no place, and counts them. The author names the source; the Design check requires one before publishing a donor submission.
- **Share links store only a hash of the token** (`InfographicShareLink.tokenHash`). Unknown, expired and revoked links all answer 404, so a link cannot be probed. The public route serves one immutable export, never a design, and is sent `noindex`.
- **Approval.** `checkDesignApprover`: the person who asked for review cannot approve it when another approver exists. Publishing needs `report.export`; approving needs `report.approve`.
- **Writers never see infographics.** The report writer receives no infographic field. A report section can hold a picture as a snapshot artifact; the picture's wording is not a writer input.
- **Portfolio designs** read the portfolio data handler, which obeys `countedElsewhere` (an indicator counted in another project is never added again).
- **Organisation brand kit** is changed only by `org.manage` (`PUT /v1/infographic-brand`).

## 3. Permissions

| Action | Permission |
|---|---|
| View a design, its exports and the data it draws on | `project.view` |
| Create, edit, delete a design; upload pictures; save layouts; generate variants; request review | `report.edit` |
| Approve or return a design | `report.approve` |
| Publish (export) a design; create or revoke a public link | `report.export` |
| Change the organisation brand kit | `org.manage` |

Every route has a rule in `apps/api/src/middleware/authorization.ts` (the coverage test fails without one).

## 4. Routes

- `GET /v1/projects/:id/infographic-data`, `GET|POST /v1/projects/:id/infographics`
- `GET|PUT|DELETE /v1/infographics/:id`, `POST /v1/infographics/:id/preview`
- `GET|POST /v1/infographics/:id/exports`, `GET /v1/infographics/:id/exports/:exportId/file`
- `POST /v1/infographics/:id/request-review | approve | return | variants`
- `GET|POST /v1/infographics/:id/share-links`, `DELETE /v1/infographic-share-links/:id`
- `GET /v1/projects/:id/infographic-suggestions`, `POST …/infographic-suggestions/ai`, `GET …/infographic-presence`
- `GET|POST /v1/infographic-templates`, `DELETE /v1/infographic-templates/:id`
- `GET|POST /v1/infographic-assets`, `GET|DELETE …/:id/file`, `GET|PUT /v1/infographic-brand`
- Portfolio: `GET /v1/portfolio/infographic-data`, `GET|POST /v1/portfolio/infographics`
- Public: `GET /public/infographics/:token` (no session), `GET /public/infographics/:token/info`
- Report sections: `…/report-sections/:id/infographics[/candidates | /:pictureId[/move]]`

The browser reaches the API through `/api/infographic-studio/<path>`, which passes only the Studio's own paths.

## 5. Deployment (2026-10-25)

1. Backup first (`scripts/backup.sh`, recorded as `BackupRun`).
2. Migration `20261027090000_infographic_studio_v2` (additive: status columns on `ProjectInfographic` and `InfographicExport`; tables `InfographicAsset`, `InfographicBrandKit`, `InfographicUserTemplate`, `InfographicShareLink`). Applied as `donordesk_migrator` with `prisma migrate deploy`.
3. Row-level security on the four new tables. The full `infra/postgres/rls.sql` stops at `ConnectorRun` (owned by `postgres`), so the four tables were applied by hand with the same statements; verify `rowsecurity` and `forcerowsecurity` on each.
4. `scripts/deploy-fast.sh` with `SCOPE=both`. The packages tar now includes `packages/infrastructure/assets` (fonts); before that fix the host had no fonts and every render would have failed.
5. `/ready` requires `InfographicExport.pageCount`, `ProjectInfographic.status`, `InfographicAsset.storageKey`, `InfographicBrandKit.brandJson`, `InfographicUserTemplate.configJson`, `InfographicShareLink.tokenHash`.
6. Host render smoke test (English and Arabic, PNG and PDF) passed in 0.2–1.4 s.

## 6. Not built

- Browser check with a signed-in account on donordesk.online (see the status line).
- Model-written text is opt-in only and is not on by default for any organisation.
- Three-way (who does what, where) rows are not derived from partner records; they are authored or drafted from the plan.
- Arabic layout is tested for right-to-left text; a native Arabic review of wording has not been done.
- Drag-and-drop of a whole layout into a different grid, and custom user templates beyond saved layouts.
- A Data Center "By location" tab (the functions already serve it).
- Tagged-PDF structure elements beyond the figure-level tags.

## 7. Support articles

Drafted but **not published**: `docs/support/_unpublished-phase32/`. They are published only after the signed-in browser check on the live site (see that folder's README for the checklist).
