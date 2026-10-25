# Phase 32 — Infographic Studio (plan, 2026-10-25)

Status: BUILT and DEPLOYED to production 2026-10-25 (releaseId=20261025113046), uncommitted, NOT YET CHECKED IN A BROWSER with a signed-in account (see §7). Batches 32.0–32.10 exist in the tree except the items listed under "Not built" in §7. Extends Phase 31 (`phase31-infograph.md`); keeps every Phase 31 invariant
(missing ≠ 0, no invented location targets, immutable exports, config-not-data, writers never see infographics).

## 0. Research basis (what UN / humanitarian products actually contain)

Sources: OCHA *Humanitarian snapshot quality-control checklist* (read in full), OCHA Graphics Stylebook (via search
summary; PDF not retrievable), humanitarianaction.info plan "at a glance" pages (Sudan/Myanmar HNRP 2026), GHO monthly
snapshots on ReliefWeb, UNICEF Global Annual Results Reports, OCHA 3W guidance (IM Toolbox), IOM DTM Insight, UNRWA/UNHCR
snapshots and factsheets. No agency publishes a formal "list of infographic types"; the families below are what the
products themselves show.

### Product families
| Family | Typical agency use | Typical content |
|---|---|---|
| **Humanitarian snapshot** (OCHA) | one story, advocacy | 3 columns: key messages + figures (left), map (centre), trends/charts (right); ≤3 themes, ideally 1; no funding/cluster data |
| **"At a glance" / response overview** (HNRP, GHO) | plan summary | People in need → targeted → prioritised funnel; requirements (US$); funding coverage + gap; breakdown by sex / age / disability; map of severity |
| **Dashboard-style 3W / operational presence** | coordination | Who-does-What-Where: partners by sector × admin area; gaps (need vs response, need vs funding) |
| **Sector / cluster results card** (UNICEF HAC, clusters) | results reporting | Target vs reached per sector, headline icon + number, % achieved, by sex/age |
| **Funding snapshot** | resource mobilisation | Requirements, received, coverage %, top donors, by sector, trend over months |
| **Displacement / mobility insight** (IOM DTM, UNHCR) | tracking | IDP/refugee stock and flow, by site/district, trend lines, sex/age pyramid, reasons for movement |
| **Situation timeline / flash update** | rapid response | Event date, affected/injured/displaced, response milestones, access constraints |
| **Factsheet / country profile** | reference | Context indicators, demographics, vulnerability, key contacts |
| **Social card / story card** | public comms | One number + one sentence + logo; square / story formats |
| **Results chain / theory of change** | donor reports | Outputs → outcomes → impact with indicator values |

### OCHA rules the Studio should enforce (checklist-derived)
- Title is specific, plain-language, title case only for the main title; **everything else sentence case**; no acronyms unless explained.
- One compelling story; ≤3 themes. Funding/cluster/needs-response-gap data does not belong in a *snapshot* (it belongs in a dashboard).
- Numbers rounded (hundreds/thousands); units/currency and time increments on every graphic title; direct labels.
- Charts: zero baseline always; sorted data; ≤5 pie slices (rest → "Other"), first slice at 12 o'clock, largest first; ≤3–4 solid lines, highlight one series (small multiples above that); no shadows/3D/borders/relief.
- Maps: simple, hierarchy of boundaries, polyline for boundaries, official **UN map disclaimer** (EN/FR/ES) and the disputed-area notes (Jammu & Kashmir, Sudan–South Sudan, Abyei…), legend for every symbol, circles/squares preferred over complex icons.
- Every data item sourced; data reliable and timely (gov/UN first, then partners; avoid media); no discrepancy with other current documents.
- Template: generic OCHA blue-banner at minimum; Arial; corporate blue (CMYK 90/57/0/0); restrained palette; **CMYK-safe print output**; PDF without hidden layers, small file; 3-column grid; "Z" reading order; white space.
- Tagged (accessible) PDF; alt text; colour-blind-safe palettes.

## 1. Gap vs the current Studio (summary of the audit)
Fixed Helvetica/blue theme, 6 templates, 8 section kinds, flow layout (no grid/drag), raster-in-PDF, A4 portrait only,
dead `branding` flag, no images/icons, no funnel/pyramid/timeline/3W/funding blocks, map = plain dots, no checks against
the humanitarian rules above, no approval or bulk output, English only.

## 2. Target feature set

### A. Visual system (themes & brand)
1. `InfographicTheme` in config: palette (≥8 categorical, sequential, diverging, status), font pair, heading style, card style, corner radius, banner style. One token table shared by preview and export.
2. Built-in themes: **UN-neutral blue**, **OCHA-style** (Arial, blue banner, restrained palette), **UNICEF-style cyan**, **WFP/IOM-style**, **Donor-neutral print (greyscale-safe)**, **High contrast / colour-blind safe**, plus **Organisation brand** (colours, logos, fonts from the org profile). We replicate *conventions*, not agency logos/marks: logo use only for logos the organisation uploads itself.
3. Brand kit per organisation: primary/secondary colours, logo variants (colour/mono/on-dark), donor logos library, standard acknowledgement lines, footer text, contact block. Implements the dead `branding` flag.
4. Icon library: a bundled open humanitarian/sector icon set (WASH, health, nutrition, education, shelter, protection, food security, CCCM, logistics, etc.) + user SVG upload (sanitised), usable in KPIs, legends, map symbols.
5. Image blocks: upload photos (with caption, credit, consent flag, crop/focal point), cover images, duotone/overlay. Photo-consent/safeguarding warning when evidence is restricted or marked as showing identifiable people; images never come from restricted evidence automatically.

### B. Layout engine
1. 12-column grid; section column/row span; gutters; manual page breaks; keep-together.
2. Drag-and-drop + keyboard moves in the Studio; snap to grid; alignment/distribution guides; undo/redo; duplicate; lock.
3. Page formats: A4 portrait/landscape, A3, Letter, 16:9 slide, 1:1 (1080), 4:5, 9:16 story, web banner; multi-page; per-format re-flow with a "does it fit" check.
4. OCHA-style **3-column snapshot layout** and other composition presets (see D).
5. One layout JSON → one renderer for preview and export (React component tree rendered in headless Chromium) so they cannot diverge. Real vector text, links, tagged PDF, print resolution; PNG at 1×/2×/3×; SVG; per-section PNG; PPTX (native shapes + chart images); web embed (read-only HTML snapshot).
6. Print: CMYK-safe palette check (gamut warning), bleed/crop marks option, PDF/A-ish small-size output, flatten layers.

### C. Content blocks (new section kinds)
Existing: KPIS, CHART, LOCATION_RESULTS, LOCATION_COMPARISON, REACH, ACTIVITIES_BY_LOCATION, MAP, TEXT. Add:
| Block | Content | Data source |
|---|---|---|
| HERO / COVER | title, subtitle, period, key image, org + donor logos | config |
| BIG_NUMBER_ROW | 1–6 headline figures with icon, unit, caption, trend arrow | indicators / reach / finance |
| FUNNEL | people in need → targeted → reached (or target → reached by sex/age) | beneficiaries + indicator targets; never invents "in need" (manual figure with source) |
| PROGRESS_RINGS / BULLET | achieved vs target, per indicator/sector | findings (rates never % of target) |
| PYRAMID | sex × age population pyramid | beneficiary breakdowns |
| SECTOR_RESULTS_GRID | one card per sector/outcome: icon, target, achieved, % | logframe levels |
| WHO_WHAT_WHERE (3W) | partners × sector × location matrix / counts per admin area | project members, planned activities, partner records |
| TIMELINE | key dates, milestones, events, period markers | plan, reports, adaptations |
| TREND_SMALL_MULTIPLES | one mini chart per indicator, shared axis rules | data sheet |
| FUNDING | requirements, received, coverage %, balance, burn rate | verified finance only |
| CHOROPLETH_MAP | admin-1 shaded by value (reach, activities, indicator) with classes (quantile/equal/manual), legend | location analytics + bundled boundaries |
| PROPORTIONAL_SYMBOL_MAP | circles sized by value | same |
| MAP_INSET / REGION_FOCUS | country, regional inset, labelled sites | gazetteer / org layer |
| RESULTS_CHAIN | outputs → outcomes → impact with values | logframe |
| QUOTE / STORY_CARD | quote + attribution + photo, consent flag | officer-typed |
| KEY_MESSAGES | 3–5 bullet messages with icon | officer-typed (AI-assisted, see F) |
| RISKS_AND_CHALLENGES / ACCESS_CONSTRAINTS | short list from risk register (non-sensitive fields only) | risks |
| LEGEND_NOTES | sources, definitions, methodology, disclaimer | provenance |
| DIVIDER / SPACER / BANNER | structure | config |
| TABLE | compact table from the data sheet with conditional formatting | data sheet |

Existing block upgrades: KPI card chooser (pick indicators, own label/unit, target ring, trend arrow, rounding rule); chart options (colour per series, highlight series, direct labels, annotations, reference lines, target line, number format, axis rules enforced); map (basemap-less admin boundaries, labels, legend, inset, scale note, disclaimer).

### D. Template library (30+, by family)
Snapshot (3-column, OCHA-style), At-a-glance / response overview, Funding snapshot, Sector results card, Sector dashboard (one-pager), 3W operational presence, Displacement / beneficiary profile (pyramid + map), Situation flash update (timeline), Donor results one-pager, Annual results poster, Project factsheet, Country/programme profile, Thematic story card, Social set (1:1, 4:5, 9:16 variants of one design), Slide-deck pages (16:9), Closure / lessons, Portfolio overview (multi-project). Each is a registry row with a version; user can **Save as my template** (organisation-private, versioned) and share across projects.

### E. Humanitarian-standards "Design check" (the differentiator)
A pure, table-driven linter `infographic-lint.ts` (domain) run live in the Studio and before publish. Rules as a table with severity (blocker/warn/tip) and a plain-language fix; each rule has a test row.
- Title: generic ("Infographic", "Snapshot") → warn; acronym unexplained → warn; sentence case in non-title text → tip.
- Story: > 3 distinct themes → warn; funding block inside a SNAPSHOT-profile design → warn (profile-specific rules).
- Numbers: unrounded figures where rounding is the convention (profile setting) → tip; unit/period missing on a chart title → warn.
- Charts: non-zero baseline → blocker; > 5 pie slices → warn; > 4 lines → warn; unsorted bars → tip; 3D/shadow cannot be produced (not offered).
- Maps: missing legend → blocker; missing disclaimer text for the chosen country set → blocker; disputed-area note required when the country is in the table; symbol overload → tip.
- Sources: any block without a source line → blocker for donor-submission profile.
- Data: unverified values plotted → badge + warn; a figure that disagrees with the latest approved report → blocker/warn (reuse record chunks and contradiction rules).
- Accessibility: contrast < 4.5:1 → blocker; colour-only encoding without label/pattern → warn; missing alt text → blocker for web export; minimum font size by format.
- Print: out-of-gamut colours → tip; images < 150 dpi at print size → warn.
- Safeguarding: photo without consent flag → blocker; small-cell disaggregation (< threshold) → warn.
Profiles: `SNAPSHOT_OCHA`, `DONOR_REPORT`, `SOCIAL`, `INTERNAL`; the profile only chooses which rules apply.

### F. Data, AI and narrative assist
1. Data binding picker: every block binds to a named data source (indicator set, reach, finance, plan, 3W, risks) with period range and location filter; "compare to previous period / same period last year" toggles; roll-up semantics obey existing rules (rates never summed).
2. AI assist (opt-in, AI Reporter pipeline): suggests a headline, key messages and chart captions **from verified findings only**; number grounding and the PII firewall apply; output goes into editable text, never straight into a published export; every AI string is flagged until a person accepts it.
3. "Suggest a layout for this story": picks a template + blocks from the data actually available (hides blocks with nothing to show).
4. Translation: labels and authored text in multiple languages per design (EN/FR/ES/AR first, RTL layout); one design → N language exports; UN map disclaimer in each.
5. Number formatting per locale; rounding rules (nearest 100 / 1,000, "over", "about") as a setting per block.

### G. Workflow & governance
1. Status: DRAFT → IN_REVIEW → APPROVED → PUBLISHED, with `checkApprover` reuse (second approver rule), comments via `COMMENTABLE_ENTITIES`, audit events.
2. Design-check blockers must be cleared (or waived with a note) to publish.
3. Bulk / scheduled: generate one per location, per period, per sector; "refresh for new period" produces a new draft from the same design, never edits a published export.
4. Insert a published infographic into a report section as a snapshot artifact (stale/refresh rules identical to Data Center charts).
5. Share: expiring read-only public link, embeddable HTML, download pack (PNG sizes + PDF + alt text + caption + sources), social caption text file.
6. Portfolio infographics via `portfolio-rollup` (counted-elsewhere indicators never added).
7. Versioning: design history, restore, compare; exports remain immutable with exact input snapshot and provenance footer.

## 3. Architecture decisions
- **One render path**: layout JSON (`InfographicDocument` v2: pages → grid blocks → block config) → React server-renderable components → Playwright/Chromium for PDF/PNG; the browser preview mounts the same components. Retire the SVG-string composer after parity tests (keep as fallback behind a flag for one release). Deterministic output requirement stays (fixed fonts bundled, no clock, stable ordering); regression test hashes the PNG of golden fixtures.
- **Config stays data-free**; v1 configs are migrated by a pure `upgradeConfig(v1) → v2` (templateVersion bump, tested on every Phase 31 fixture).
- **Fonts**: bundle Arial-metric-compatible (Liberation Sans / Arimo), Roboto, Inter, Noto (incl. Arabic) – licence-checked; no runtime CDN.
- **Assets**: new `InfographicAsset` (tenant, kind IMAGE|ICON|LOGO|FONT, storageKey, consent, credit) + RLS; brand kit as `OrganizationBrandKit`; user templates as `InfographicUserTemplate`. All additive migrations; re-run `rls.sql`; `/ready` allowlist entries.
- **Lint is domain code** (pure, table-tested); the UI and the publish handler call the same function (one rule, as with `checkApprover`).
- **Map**: bundled admin-0/1 boundaries stay; add vector export of the same projection; UN disclaimer table lives in domain (`map-disclaimers.ts`), keyed by country code; org custom layer (existing) wins as the base map.
- **No external services**: no tile servers, no stock-image APIs, no cloud design tools; nothing leaves the tenant.
- Authorization: new routes get rules in `authorization.ts` (coverage test); assets `report.edit`; approve `report.approve`; public link `report.export`.

## 4. Batches (suggested order)
| Batch | Scope | Rough size |
|---|---|---|
| 32.0 | Document v2 + `upgradeConfig`, theme tokens, shared renderer skeleton, fonts, golden-fixture tests | L |
| 32.1 | Renderer switch: Chromium PDF/PNG/SVG, tagged PDF, formats (A3/landscape/square/story/16:9), preview parity | L |
| 32.2 | Grid layout + drag-and-drop + undo/redo + page breaks | L |
| 32.3 | Themes, brand kit, icon library, image/logo assets, consent flags | M |
| 32.4 | New blocks I: Hero, Big numbers, Rings/bullet, Funnel, Pyramid, Sector grid, Timeline, Key messages, Legend/notes | L |
| 32.5 | New blocks II: Choropleth + proportional-symbol maps, insets, disclaimers, 3W matrix, funding, small multiples, results chain, table | L |
| 32.6 | Template library (≥ 16 presets) + user templates | M |
| 32.7 | Design-check linter + profiles + publish gate | M |
| 32.8 | AI assist (headline, messages, captions, layout suggestion), grounded | M |
| 32.9 | Workflow: status, approval, comments, audit, bulk/scheduled, share links, report insertion, portfolio | L |
| 32.10 | Multi-language / RTL, locale number formats, PPTX export | M |

Each batch ships behind `INFOGRAPHIC_STUDIO_V2` (feature flag) until 32.1–32.3 are verified in a browser with the user's account.

## 5. Risks / decisions needed
1. **Chromium is DROPPED (decided 2026-10-25 after checking the host: ~3 GB free of 12 GB, only a snap Chromium, no Arial/Liberation fonts). Renderer = bundled fonts + resvg (PNG) + svg-to-pdfkit (vector PDF), one render at a time; see 32.1 log.
2. **Agency look-alikes**: we offer OCHA-*style* layout/palette conventions only; no agency logos, emblem or wording that implies endorsement. The UN map disclaimer is a required text, not a logo.
3. **Disputed-area cartography** needs a reviewed boundary dataset (Natural Earth is not UN-authoritative); scope as "disclaimer + note", not authoritative boundaries, unless the org uploads its own layer.
4. **AI text** is the highest-risk feature; ship after the lint and approval workflow.
5. **Fonts/icons licensing** must be checked before bundling.
6. Open questions for the product owner: which outputs donors actually require (print PDF vs social vs slides); whether snapshots should allow funding blocks at all (OCHA says no); languages needed first; whether free-form (non-grid) placement is wanted.

## 6. Build log
### 32.0 (partial) — theme tokens, 2026-10-25
- `packages/domain/src/contexts/infographics/theme.ts`: `INFOGRAPHIC_THEMES` (DEFAULT, HUMANITARIAN_BLUE, CYAN, HIGH_CONTRAST, PRINT_MONO), `resolveTheme` (absent/unknown id = DEFAULT), `contrastRatio`. `InfographicConfig.themeId` optional; `validateConfig` refuses unknown ids and writes none for a design that never chose one; contracts schema accepts it.
- Composer reads every colour/font/radius from the theme (`t` threaded through all slot builders). **DEFAULT output is byte-identical to Phase 31 for all six templates** (checked against the previous composer). DEFAULT keeps three legacy low-contrast tokens (accent, subtle, mapNote) on purpose; every other theme passes AA 4.5:1 (test-pinned).
- Studio: "Design" panel with theme picker + palette swatches; preview uses the theme font/accent/radius.
- Not yet in 32.0: document v2 (grid) and `upgradeConfig` (nothing structural changed yet, so not needed), bundled fonts (Arial themes rely on the host having Arial/Liberation; bundle in 32.1), chart colours from the theme palette (`buildDataChart` still uses its own palette; do in 32.3).

### 32.1 (renderer part) — lightweight pipeline for the Contabo host, 2026-10-25
- No browser. `packages/infrastructure/src/infographics/raster.ts`: `svgToPng` (`@resvg/resvg-js`, system fonts never loaded), `addSvgPage` + `newPdf` (`svg-to-pdfkit`, tagged PDF, fonts embedded), `withRenderSlot` (one render at a time). Fonts: Liberation Sans Regular/Bold/Italic/BoldItalic (SIL OFL, Arial-metric) in `packages/infrastructure/assets/fonts/` with the licence; they ship in the packages tarball (only node_modules/dist/.cache/coverage are excluded). Host is x86_64, glibc 2.39: the resvg linux-x64-gnu binary matches the dev machine's pnpm store that `deploy-fast.sh` ships.
- Measured locally: PNG (2480×3508) ~450 ms, vector PDF ~250 ms and 33 KB (was a page image), RSS +~55 MB. PDF text is selectable; a page the vector writer cannot draw falls back to an image of that page.
- sharp is no longer used by the composer (still a dependency for other exports).
- Fixed while checking the output: the 4th KPI card overflowed its panel; the location-results panel reserved 30 rows of height (now sized to the rows drawn). Test-pinned.
- Still to do in 32.1: page formats (A3, landscape, square, story, 16:9), real tag structure in the PDF (pdfkit marks it tagged but we do not yet add structure elements), chart SVG embedded as vector instead of PNG, `@resvg` + font check in the `/ready` or a render smoke test on the host after deploy.

## 7. State at 2026-10-25 (end of build session)
Verified: `pnpm -r typecheck` clean; `next build` of apps/web succeeds; tests green: domain 872, application 758, web unit 463, infrastructure infographic + RLS-coverage suites (5 DB-backed skip without a database). The two api failures (`sensitive read routes enforce RBAC…`, `own-account routes have a tenant container`) only fail because no Postgres is running on localhost:5432 (project-boundary reads `ProjectMember`); they are not regressions.

Built: 22 templates, 25 blocks, 9 page formats, 5 themes + organisation brand theme, EN/FR/ES/AR (Arabic: bundled Noto Sans Arabic, RTL mirroring via `RenderCtx.rtl`). Outputs PNG, vector PDF, SVG, PPTX, ZIP pack; no browser (resvg + svg-to-pdfkit, bundled fonts). Studio: preview drawn by the same code as the export, drag, undo/redo, click-to-edit, Design check (`lint.ts`), headline/key-message suggestions from records (fixed patterns, no model), image library, brand kit, saved layouts. Workflow: review/approval, public share links (`/public/infographics/:token`), per-location/per-period variants, comments, auto-refresh, portfolio designs (`/v1/portfolio/infographics`), insertion into a report section (`SectionInfographicsHandler`, routes in `reporting.ts`, `InfographicsPanel`). Security: a crafted logo value could inject script into a downloaded SVG; closed and tested.

Deploy: migration `20261027090000_infographic_studio_v2` (additive, before the code; adds status columns on `ProjectInfographic`/`InfographicExport` and tables `InfographicAsset`, `InfographicBrandKit`, `InfographicUserTemplate`, `InfographicShareLink`), then re-run `infra/postgres/rls.sql` (check `rowsecurity` on the four new tables). `/ready` requires `InfographicExport.pageCount`, `ProjectInfographic.status`, `InfographicAsset.storageKey`, `InfographicBrandKit.brandJson`, `InfographicUserTemplate.configJson`, `InfographicShareLink.tokenHash`. Ship api and web together; after deploy run a render smoke test on the host (resvg native binary + fonts).

Not built / not checked:
- Browser verification of the Studio with the user's account (required before removing the `INFOGRAPHIC_STUDIO_V2` caution, §4).
- Model-written text (AI headline/captions). Suggestions are deterministic; AI text stays deferred until number grounding + PII firewall are wired for it (§5.4).
- 3W matrix is author-typed (`presence` rows, source required by the Design check), not derived from partner records.
- Tagged-PDF structure elements, chart SVG embedded as vector (see 32.1 log).

### Update (same day, after the first §7)
- Built: opt-in model-written headline and key messages (`GetInfographicAiTextHandler`, `POST /v1/projects/:id/infographic-suggestions/ai`, `ai-text.ts`: strict JSON parse, PII redaction before sending, every sentence with a figure the records do not hold is dropped; unavailable when the organisation's AI is off; the Studio labels the result "AI-drafted, not yet reviewed"). Derived 3W: `SuggestPresenceRowsHandler` (`GET …/infographic-presence`) drafts rows from the plan (lead, title, place; no lead or place = skipped, counted); the 3W editor has "Draft rows from my plan". Tagged-PDF structure already existed (`beginStructure`/`inFigure`).
- Deployed 2026-10-25: DB backup (`/opt/donordesk/backups/donordesk/20261025T112914Z`) → migration `20261027090000_infographic_studio_v2` by `prisma migrate deploy` with the migrator URL → RLS applied per table (the whole `rls.sql` stops at `ConnectorRun`; the four new tables are enabled + forced) → `deploy-fast.sh SCOPE=both` → `/ready` 200. Host render smoke (`InfographicComposerRenderer`, en + ar, PNG + PDF) passes in 0.3–1.4 s.
- **Deploy bug fixed**: the packages tar did not include `packages/infrastructure/assets` (the bundled fonts), so the first deploy had no fonts on the host; `deploy-fast.sh` now ships it (fonts were also copied by hand).
- Left: browser check with the user's account on donordesk.online; commit.
- Feature doc with the rules and routes: `memorybank/Features/44-Infographic-Studio.md`. Support drafts (unpublished): `memorybank/docs/support/_unpublished-phase32/`.
