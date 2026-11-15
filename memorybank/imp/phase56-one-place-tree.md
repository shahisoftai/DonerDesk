# Phase 56 — One place tree: where the organisation works, project by project (plan, 2026-11-15)

**DonorDesk Version 4.01** · branch to create: `0025-place-tree` · status: **plan only, nothing built**

## 0. Why

The user asked why Places sits in Settings when places are managed on projects. The investigation (2026-11-15) found:

- There is **one** list (`Place`, tenant-scoped, no project) behind **two** screens: Settings → Places and the project's
  Plan → Where we work. The project page shows the whole organisation's list ("Points", "To confirm" are not filtered), and
  an area shows ticked on every project as soon as any project ticked it (`listedRefs` reads the organisation list).
- Only planned activities link to places by id (`PlannedActivityPlace`). Completed activities, evidence and people reached keep
  typed text matched on every read; indicator values by place store the place **name** as the `LOCATION` category
  (`place-recording.ts:88`), so a rename splits history and two same-named villages collide.
- Settings → Places has two jobs found nowhere else (seed from boundaries, map context layers) and contradictory copy
  ("Plan ›" vs "Data →").

### 0.1 What the competitors do (documented; sources §14)
| | ActivityInfo | DevResults |
| --- | --- | --- |
| Official areas | Built-in public geodatabase (country → admin level), maintained by the vendor; a form field references it | Admin divisions from GADM / HDX, fully nested, updated on request with a crosswalk file |
| The organisation's own places | Reference forms (sites, health centres) in the database, shared by every form | One site-wide Locations list under Administration, Excel import, merge-duplicates tool |
| What a project covers | Decided by forms and permissions | Project → Geography tab, one tab per level: places are **assigned** to the project |
| Adding a place during entry | Yes, in the form, when the person may add to the reference form | No: an administrator adds it first |
| Roll-up | Through admin levels | A point counts toward the area its coordinates fall in; no coordinates = no roll-up |

Neither keeps a list per project. Both have **one shared geography and attach projects to it**. DevResults adds an explicit
project assignment; ActivityInfo adds "add it where you are". We take both, and add what neither has: every record holds
the place's id, typed words are confirmed once, and the organisation's map is derived from the work.

## 1. The model (decided with the user)

```
Built-in boundaries ─▶ Place tree (organisation) ─▶ Project footprint ─▶ work plan · activities · indicators · evidence · people
```

**One rule: every "where" in DonorDesk points to one node of the organisation's place tree, as precise as is known.**

| Concept | What it is | Source |
| --- | --- | --- |
| **Place tree** | Country → province → district → town → village/site; one tree per organisation | Official areas materialise from boundaries **when first used**; villages and sites are added by people, always under a parent |
| **Project footprint** | The areas a project covers (`ProjectArea`) | Ticked on the project's Where we work map |
| **Planned activity** | Takes place at one or more places inside the footprint | `PlannedActivityPlace` (exists) |
| **Completed activity** | Happened at specific places | Inherited from its planned activity, narrowed by the officer (`ActivityUpdatePlace`, new) |
| **Indicator** | Measured for the project, or at a level ("by district"), or at chosen places | Entry rows = footprint places at that level; values keyed by **place id** |
| **Evidence, people reached, form answers** | Where they were collected | Inherited from the activity, else picked (`EvidencePlace`, `BeneficiaryPlace`, form PLACE answers carry `placeId`) |
| **Organisation's where we work** | Union of footprints + every place work happened | **Derived, never maintained by hand** |

Example the plan is tested against (fixture `two-projects-one-village`):

```
Country
├── Province A ── District A1 ── Town T ── Village 1, Village 2
│                └ District A2 ── Village 3
└── Province B ── District B1 ── Clinic X, Water point Y
Project 1 (WASH):   footprint A1, A2 · activities at Village 1, 2, 3
Project 2 (Health): footprint A1, B1 · activities at Village 1, Clinic X
```
Village 1 is **one** place; the organisation map shows two projects there.

## 2. Invariants (go into AGENTS.md when built)

1. **A where is an id.** Every new link stores `placeId`; typed text is kept beside it as written, never replaced.
2. **One tree.** A place has at most one parent, strictly one admin level above (existing `validatePlace`). A village or site
   is never stored without a parent: the parent is chosen, or derived from the pin (`containingFeature` / point-in-polygon
   against materialised areas), or the person is asked. No floating places.
3. **Materialise on use.** Boundaries stay files; a boundary unit becomes a `Place` row only when a project ticks it, a record
   points at it, or a child is placed under it (`materialiseUnit`, idempotent by P-code then name + parent). Its ancestors are
   materialised with it.
4. **Footprint is advisory.** Work outside the footprint is allowed, shown ("Village 4 is outside this project's areas") with a
   one-click "Add District A3 to this project". Never a refusal.
5. **Roll-up follows the tree.** A figure at a node counts toward every ancestor for that project. Additive types sum; a rate is
   shown only where recorded and combined only as Σ part ÷ Σ whole when both parts are recorded (existing rules); a gap is
   null, never 0. Across projects, `countedElsewhere` still decides what is never added.
6. **Typed words are confirmed once.** An unmatched word goes to "To confirm"; confirming it writes the link on every record
   carrying that word in that project (audited), then the word no longer appears. Ambiguous words are never auto-linked.
7. **Identity survives change.** Rename keeps the id. **Merge** moves every link to the surviving place and leaves the merged
   row with `mergedIntoId` (reads follow it). Official boundary changes are reviewed (existing `BoundaryChangesCard`) and
   applied through merge / re-parent, never automatically.
8. **The organisation map is derived.** No screen asks a person to keep an organisation list up to date.
9. **Footprint never leaks.** Share links and the public API see a project's places only under existing rules
   (`ShareLinkExtras`, API scopes); restricted datasets never expose places.

## 3. Domain (pure, `packages/domain/src/contexts/places/`)

New files (≤300 lines each, no classes, table-driven):
- `place-tree.ts` — `ancestorsOf`, `descendantsOf`, `isInside(child, area)`, `deepestCommonArea`, `followMerge(id)`.
- `footprint.ts` — `footprintOf(areas)`, `insideFootprint(place, footprint, tree)` → `INSIDE | OUTSIDE | UNKNOWN`,
  `extensionFor(place, footprint, tree)` (the smallest area at the footprint's level that would include it).
- `place-link.ts` — `PlaceLinkRule` table per record kind (`PLANNED_ACTIVITY`, `ACTIVITY`, `EVIDENCE`, `BENEFICIARY`,
  `FORM_ANSWER`, `INDICATOR_VALUE`): `inheritsFrom`, `many`, `requiresLevel`. One table, no branches on kind names.
- `place-inherit.ts` — `inheritPlaces(record, parent)`: activity from planned activity, evidence from activity,
  beneficiary from activity; fills only empty, never overwrites a choice.
- `indicator-places.ts` — `indicatorPlaceScope` (`PROJECT | LEVEL | CHOSEN`), `entryRows(indicator, footprint, tree)`,
  `valueKey(placeId)`; reading legacy name-keyed breakdowns via `legacyCategoryToPlace` (unique match only).
- `place-rollup-v2.ts` — extends `rollupByPlace` to read ids, follow merges, and roll up across projects for the
  organisation view (`portfolioByPlace`, obeys `countedElsewhere`).
- `place-merge.ts` — `checkMerge(a, b, tree)`: same level, no cycle, children re-parented, refuses merging a place into its
  own descendant; returns the plan of link moves.
- `three-w.ts` — `whoWhatWhere(projects, links, tree, level)` → per area: projects, activity counts, results (derived only).

Contracts: Zod schemas mirrored in `packages/contracts/src/places.ts`; the kind list in `place-link.ts` and contracts pinned by
the architecture test.

## 4. Data (migration `20261119090000_place_tree`, additive)

```prisma
model ProjectArea {            // the footprint
  id String @id; tenantId String; projectId String; placeId String
  closedAt DateTime?; closedReason String?   // closed = no new work, history kept
  createdById String; createdAt DateTime @default(now())
  @@unique([projectId, placeId]) @@index([tenantId, placeId])
}
model ActivityUpdatePlace { id; tenantId; projectId; activityUpdateId; placeId; source String /* INHERITED|CHOSEN|CONFIRMED|GPS */; createdById; createdAt
  @@unique([activityUpdateId, placeId]) @@index([tenantId, placeId]) }
model EvidencePlace       { … evidenceFileId …  same shape }
model BeneficiaryPlace    { … beneficiaryId …   same shape }
model PlaceWordLink {          // a confirmed typed word, per project
  id; tenantId; projectId; word String /* normalizeLocationKey */; placeId; confirmedById; confirmedAt
  @@unique([projectId, word]) }
```
Changes to existing tables:
- `Place.mergedIntoId String?`, `Place.boundaryRef String?` (file key + P-code it was materialised from).
- `Indicator.placeScope String @default("PROJECT")`, `Indicator.placeIdsJson String?` (for `CHOSEN`); `recordByPlace`/`placeLevel`
  stay and map to `LEVEL`.
- Indicator breakdown entries (JSON) gain an optional `placeId` beside `category`; name-only entries stay readable.
- `PlannedActivityPlace` unchanged.

RLS: per-table for the five new tables (check `relrowsecurity`/`relforcerowsecurity`). `/ready` requires `ProjectArea.placeId`,
`ActivityUpdatePlace.placeId`, `Place.mergedIntoId`, `Indicator.placeScope`. Organisation export lists the new tables.
Repositories: one per aggregate (`PrismaProjectAreaRepository`, `PrismaRecordPlaceRepository` generic over the three link tables
via a table map, `PrismaPlaceWordLinkRepository`); `update` methods write every field with `?? null` (persistence tests).

## 5. Filling existing data (backfill, idempotent script `places:backfill`)

Runs per tenant as the migrator, dry-run first (`--apply` to write), writes an audit row with counts only.
1. **Footprint**: for each project, areas ticked so far (places listed by its own records) + the areas containing its planned
   activity places, at the most common admin level of those areas; if none, nothing (the project page asks).
2. **Activities**: `ActivityUpdate.plannedActivityId` → copy its `PlannedActivityPlace` rows (`INHERITED`); else
   `resolvePlace(location)` RESOLVED → link (`CONFIRMED`, by backfill); else leave for "To confirm".
3. **Evidence / beneficiaries**: activity's places if linked; else typed location as in 2.
4. **Indicator values**: each `LOCATION` entry whose category matches one place inside the project's footprint gets `placeId`;
   others untouched (still read by name).
5. **Ancestors**: materialise missing parents for every linked place.
Report per project: linked, inherited, left to confirm, ambiguous. Nothing typed is rewritten; nothing uncertain is guessed.

## 6. Application (handlers, `packages/application/src/use-cases/places/`)

- `SetProjectAreasHandler` (tick/untick; **untick is refused while any record of this project points at the area or a place
  inside it** — planned or completed activities, indicator values, evidence, people reached — and the refusal names the counts with
  links to them; `CloseProjectAreaHandler` instead marks the area closed (`ProjectArea.closedAt`, `closedReason`): history and
  roll-up are kept, the picker stops offering it for new work, it can be reopened), `ListProjectPlacesHandler` (footprint + places used
  + counts), `AddPlaceInlineHandler` (name, kind, parent or pin, optional facility type; materialises; links to the project
  footprint when outside and the person agreed), `LinkRecordPlacesHandler` (one handler, record kind from `place-link.ts`),
  `ConfirmPlaceWordHandler` (writes `PlaceWordLink` + links matching records, ATOMIC), `MergePlacesHandler` (ATOMIC, `org.manage`),
  `GetPortfolioWhereWeWorkHandler` (3W), `GetPlaceProfileHandler` (a place's projects, activities, values, files — only projects
  the viewer can see).
- Existing handlers changed: `CreateActivityUpdateHandler`/update (accept `placeIds`, inherit), evidence upload/link
  (`EvidenceLinkService` inherits places with the activity), `QuickEnterIndicatorValueHandler` / bulk upsert (place ids in
  breakdowns), `ApplyCollectionTotalsHandler` (form PLACE answers by id), `GetProjectPlaceResultsHandler` (ids + merges),
  offline pack (`GetOfflinePackHandler`: footprint + places under it, same permission rules).
- Every change audited (`place.area_set`, `place.added_inline`, `place.word_confirmed`, `place.merged`); webhook rows none.
- Permissions: `project.view` reads; `project.edit` sets footprint, adds inline, confirms words; `activity.create` /
  `indicator.update` link places on their own records; `org.manage` merges, retires, map layers, facility types.
  Routes added to `RULES` (and `EXTERNAL_ALLOWED` only for linking on a partner's own records and adding inline at site level).

## 7. Screens

### 7.1 Project → Plan → Where we work (one page, three tabs)
- **Areas**: the existing `ProjectAreaPicker`, now writing `ProjectArea` (ticked = this project's footprint only).
- **Sites**: villages, towns, facilities this project uses, grouped under their area; map + table; "Add a site" (name, kind,
  pin or parent). Shows counts (activities, values, files) per site.
- **To confirm**: only this project's unmatched words, with "Is this … ?" suggestions; confirming fixes every record.
- Banner when records sit outside the footprint, with "Add these areas".

### 7.2 The one place picker (`PlacePicker`, `features/places/presentation/picker/`)
Used by work plan, completed activity, Record sheet, Enter data, evidence, people reached, collection forms, datasets.
Order: this project's sites → its areas → other organisation places (labelled) → boundary units (labelled, materialised on pick).
"Add a new place" inline (permission-aware; offline: queued as a typed word). Shows the path ("Village 1 · Town T · A1") so
same-named places are told apart. Multi-select where the link rule says `many`. Keyboard and 44 px touch rules apply.

### 7.3 Indicator → "Where is this measured?"
Three choices (`PROJECT` / `LEVEL` / `CHOSEN`), entry rows previewed. Replaces the bare record-by-place toggle; the wizard's
`PLACE_RECORDING` launch step writes `LEVEL`.

### 7.4 Organisation → Where we work (replaces Settings → Places)
Sidebar: under the organisation/portfolio hub, not Settings. A derived map and table at a chosen level: per area the projects,
activities, results (3W), filter by sector/donor/period. Click an area → **place page** (7.5).
"Manage places" (only `org.manage`): merge duplicates (suggested by same name under the same parent, near pins, or same code),
retire, bulk import/export (existing templates), facility types, boundary update review, map layers & imagery
(`MapContextCard` moves here). `/settings/places` redirects here (route-map row).

### 7.5 Place page (`/places/[id]`)
Breadcrumb path, small map, and for that place and everything under it: projects working there, activities (planned/done),
indicator values by project, files and photos. Only what the viewer may see.

### 7.6 Copy
`places-copy.ts` rewritten around "areas", "sites", "where we work"; four languages (drafts); copy lint and route map updated.
Every link to `/settings/places` (Data Center, photo map, activity places, dataset places step, import guide) points to the
project's Where we work, or the organisation page when there is no project.

## 8. Reports, maps, dashboards, exports
- Results by place, maps, canvas map blocks, figure cards and the 3W block read ids and follow merges; legacy name matching stays
  as fallback.
- Writer: `period.scope` and findings may name places by their display path; no new writer field, no contract version change.
- Record chunks: "activities held at …" uses linked places (claims about locations verify against them).
- Exports: places CSV/GeoJSON gain `footprint` and project columns; templates (`places`, `activities`) add a place-code column;
  public API `GET /api/v1/projects/:id/places` (scope `places:read`), MCP unchanged except ids in `get_results_by_place`.

## 9. Offline and field
Pack v3 (additive): footprint + places under it (ids, names, parents, pins). Records made offline carry `placeIds` when picked,
typed words otherwise; the sender links on arrival. A new site added offline is queued with its parent and becomes a real place
when sent (dedupe by name + parent).

## 10. Batches

| Batch | Scope | Done when |
| --- | --- | --- |
| **56.0** | Domain: tree, footprint, link rules, inherit, merge, indicator scope, roll-up v2, 3W; fixture `two-projects-one-village` | Table tests green; architecture test pins kind list |
| **56.1** | Migration, RLS, repositories, `/ready`; backfill script (dry-run) | Scratch Postgres: migrate, RLS on, backfill report on a copy of demo data |
| **56.2** | Project footprint: `ProjectArea`, Areas tab writes it, Sites tab, To confirm per project, outside-footprint banner | A tick in project 1 no longer shows in project 2 (regression test) |
| **56.3** | One `PlacePicker` + inline add; work plan and completed activity (inherit) | Record sheet and plan use it; offline queue works |
| **56.4** | Indicators: place scope, id-keyed values, entry rows, legacy reading; quick entry and bulk save | Rename a place: history stays one row; two same-named villages stay apart |
| **56.5** | Evidence, people reached, collection forms, datasets link by id | Inheritance tests; photo map reads ids |
| **56.6** | Organisation Where we work (3W) + place page; Settings → Places redirect; housekeeping incl. merge | Merge moves every link (DB journey test) |
| **56.7** | Reports, maps, canvas, exports, public API, offline pack v3 | Results by place equal before/after on demo projects |
| **56.8** | Copy (4 languages), support articles (Where we work, places), AGENTS.md invariants, browser harness `test:places` | Harness green; live check on DEMO-14/15/16 |

Each batch: test only what changed; full suites before the release.

## 11. Verification
- Unit: domain tables (every link rule, inheritance never overwrites, merge plans, roll-up with gaps and rates, outside-footprint).
- DB journey (`UOW_VERIFY_DATABASE_URL`): backfill idempotent (run twice = same), merge atomic, confirm-word atomic, RLS per table.
- Browser harness `test:places`: tick areas, add a site inline from the Record sheet, confirm a word, outside-footprint banner,
  organisation map shows two projects in Village 1, place page.
- Live: DEMO-16 (Kenya Education) and DEMO-14 (Nepal) results by place identical before and after backfill.

## 12. Deploy
Fresh backup → migration `20261119090000_place_tree` → per-table RLS (`ProjectArea`, `ActivityUpdatePlace`, `EvidencePlace`,
`BeneficiaryPlace`, `PlaceWordLink`; check `relrowsecurity`) → `deploy-fast.sh BUILD_ON=host SCOPE=both` → `places:backfill`
dry-run, read the report, then `--apply` → live check. `/ready` pairs as in §4. No env.

## 13. Risks and open questions
- **Backfill footprint guesses** — mitigated: only from the project's own records; uncertain → empty, the page asks.
- **Untick an area with records inside** — decided 2026-11-15: refused, with counts and links; "Close this area" stops new work and keeps history.
- **Merge across projects** is organisation-wide: only `org.manage`, previewed with counts, audited.
- **Partners** adding sites — decided 2026-11-15: yes, sites only, inside the project's footprint.
- **Indicator `CHOSEN` scope with per-place targets** — decided 2026-11-15: reuse `targetBreakdowns` (LOCATION) keyed by place id.
- Not in scope: drawing new admin boundaries by hand (existing uploaded boundary layers cover it), moving a project between
  countries.

## 14. Sources
- ActivityInfo — Referencing the Geodatabase: https://www.activityinfo.org/support/docs/forms/referencing-the-geodatabase.html
- ActivityInfo — New features for reference data (add in place): https://www.activityinfo.org/blog/posts/2023-09-13-new-features-for-working-with-reference-data.html
- ActivityInfo — 3W template: https://www.activityinfo.org/support/templates/3w.html
- DevResults — Geographies: https://devresults.knowledgeowl.com/help/geographies
- DevResults — Define a Location: https://devresults.knowledgeowl.com/help/add-a-location
- DevResults — Assign a Geography to a Project: https://devresults.knowledgeowl.com/help/assign-a-geography-to-an-activity
- DevResults — Which admin levels: https://devresults.knowledgeowl.com/help/which-administrative-division-levels-should-i-use
- DevResults — Update admin divisions: https://devresults.knowledgeowl.com/help/update-admin-divisions
- DevResults — Mapping functionality: https://devresults.knowledgeowl.com/help/mapping-functionality
