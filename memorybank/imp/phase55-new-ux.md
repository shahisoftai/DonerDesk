# Phase 55 — The new UX (Version 4.000)

**DonorDesk Version 4.01** · plan written 2026-11-14 · branch: `0024-new-ux` (3.007 is tagged `v3.007`) · status: **IMPLEMENTATION 2026-11-14 (§8 lists what is built and what is partial)**

## 0. Why

An audit of all 155 web routes (2026-11-14) found the product does a great deal, but people reach it through too many doors:
12 sidebar entries, 25+ project sub-pages, 4 ways to create a project, 5 places to enter a value, 7 import pages, 4 inboxes.
The look also drifted: buttons are styled in two places, about 107 hand-written link styles, two different slide-over panels.

Version 4.000 has two goals:
1. **Fewer doors.** One place per job; everything else is a view of it or a link to it.
2. **A modern, calm, corporate look** (inspiration: Linear, Vercel, Stripe, Notion, Figma): a new colour brand, one button
   system, one link system, one slide-over, a command palette that acts, skeletons and undo.
3. **Pages that read in sections.** Every page is a clear stack of separated sections, never a wall of mixed cards.

The findings are numbered F1–F80 below (the same numbers used in the conversation of 2026-11-14) and each is assigned to a batch.

## 1. Rules for the whole phase

- **No feature is lost.** Every route that moves or merges gets a row in `phase55-route-map.md` (old address → new address,
  redirect or kept). A test reads that file like `visual-parity.test.mts` and fails on an unmapped route or a link to a
  redirected one.
- **Redirects, not 404s.** An old address keeps working (relative redirects; see the Phase 45 cutover note).
- **No business rule changes.** This phase moves and restyles; handlers, permissions, honesty rules and the API stay as they
  are. Where a batch needs a server change it is named and kept additive.
- **Roles still see only their own buttons** (`ROLE_SURFACES`, `sectionsFor`, `HOME_TILES_BY_VARIANT`): a merged screen
  is composed from the same tables, never by branching.
- **Accessibility does not regress**: 44 px touch targets under `pointer: coarse`, visible focus, reduced motion respected,
  right-to-left mirrored, WCAG AA contrast (`design-tokens.test.mts` extended to the new tokens).
- **Copy** goes through the typed catalogue in four languages (drafts; native review still owed).
- **Verification per batch**: unit tests of what changed, the affected browser harnesses, and `test:visuals` pictures
  refreshed and reviewed. A signed-in browser check on production after each deploy.
- **Deploy** with the quickest safe method (`deploy-fast.sh`, smallest scope, batched).

## 2. Findings

### 2.1 Navigation and structure
| # | Finding | Recommendation | Batch |
|---|---|---|---|
| F1 | 12 top-level sidebar entries | Four groups: Home, Projects, Reports, Admin; Evidence, Compliance, Downloads under Reports; Portfolio under Home | 55.3 |
| F2 | Home and My Work overlap | One Home with "My work" as its first section | 55.3 |
| F3 | Four inboxes (`/waiting`, `/notifications`, `/my-work`, Needs you) | One Inbox (To do, Mentions, Updates); Waiting to send stays its own page | 55.3 |
| F4 | 25+ project sub-pages | Six tabs: Overview, Plan, Data, Evidence, Reports, Settings; the rest nested | 55.4 |
| F5 | Unused features always shown | Hide Datasets, Forms, Ask, Report builder, Adaptations, Beneficiaries until switched on or holding content | 55.4 |
| F6 | No global search | Ctrl-K search (merged with F69) | 55.2 |
| F7 | Deep pages lose their place | Breadcrumbs on every page below a project | 55.4 |
| F36 | Field officers may reach admin pages via More | Pin field navigation to Today, Record, Waiting, Projects; test per role | 55.3 |
| F37 | Outside partners land on a generic list | Partner landing: their tasks per project | 55.3 |
| F38 | Several names for one thing (Visuals/Canvas/Dashboards and infographics; Programmes/Funding; Evidence/Files) | One glossary (`ux-glossary.ts`), copy lint fails a retired word | 55.1 |
| F39 | Redirect-only routes linger | Remove after one release of redirects with no hits | 55.10 |

### 2.2 Project creation and setup
| # | Finding | Recommendation | Batch |
|---|---|---|---|
| F8 | Four ways to create a project | One entry: the wizard, "Start from a document" as its first choice; classic path retired (F84) | 55.5 |
| F9 | 10 slides before launch | Short path (name, sector, country, results → launch); the rest becomes the project's setup checklist | 55.5 |
| F10 | Onboarding is 4 pages plus setup pages | One "Get started" checklist with progress | 55.5 |
| F11 | "Setup packs" vs "Requirement packs" confuse | One Settings → Defaults page with clear names | 55.5 |

### 2.3 Data entry
| # | Finding | Recommendation | Batch |
|---|---|---|---|
| F12 | Five places to enter a value | Record sheet is the entry; Enter data, Entry Sheet, Inputs, inline become views opening it | 55.6 |
| F13 | Seven import pages | One Import page that recognises the file (extends "Bring in data" and `suggestImports`) | 55.6 |
| F14 | Template download far from upload | Template link beside every upload box; same column names | 55.6 |
| F15 | Blocked import fixed only via error file | Fix rows on screen as well as by file | 55.6 |
| F16 | Hand-in/verify clicks for small teams | Offer simple review at organisation creation (default stays off for existing) | 55.6 |
| F17 | "Verify all" fails on missing files | Attach-then-verify in one flow | 55.6 |

### 2.4 Reports
| # | Finding | Recommendation | Batch |
|---|---|---|---|
| F18 | Period sub-pages separate | One stepper: Inputs → Draft → Review → Export | 55.7 |
| F19 | Readiness is a list of blockers | One "Next step" button, the list behind it | 55.7 |
| F20 | "Reports" and "Report builder" collide | Rename the builder "Data tables", move it under Data | 55.7 |
| F21 | Closing report is its own route | A type in "New report" | 55.7 |

### 2.5 Visuals and maps
| # | Finding | Recommendation | Batch |
|---|---|---|---|
| F22 | `/visuals` shows seven tools at once | Templates and recent first; tools behind a Tools menu | 55.8 |
| F23 | Two chart editors (Data Center, Studio) | One editor, linked from both | 55.8 |
| F24 | "Add to dashboard" differs per place | One shared action and dialog | 55.8 |
| F25 | A first map needs setup first | "Show this indicator on a map" sets it up in one action | 55.8 |

### 2.6 Places, team, settings
| # | Finding | Recommendation | Batch |
|---|---|---|---|
| F26 | Places in two locations | Project → Where we work owns it; Settings links | 55.9 |
| F27 | Organisation and project team separate | Invite and choose projects in one step | 55.9 |
| F28 | 13 settings pages | Groups: Organisation, Security, Billing, AI, Data defaults, Integrations | 55.9 |
| F29 | AI switches scattered | One AI page | 55.9 |

### 2.7 Feedback and forms
| # | Finding | Recommendation | Batch |
|---|---|---|---|
| F30 | Feedback inconsistent | One toast pattern, cause + next step | 55.2 |
| F31 | Only some forms keep drafts | `createDraftStore` on every long form | 55.6 |
| F32 | Empty lists are bare | One empty state: icon, sentence, one action | 55.2 |
| F33 | Long dropdowns | Searchable picker (indicator, period, place, person) | 55.2 |
| F34 | Known phone gaps | Period-input cards, GPS "Here", ≤640 px fallbacks | 55.6 |
| F35 | Draft translations offered as finished | Label the switcher "beta" until native review | 55.1 |

### 2.8 Visual system (current problems)
| # | Finding | Batch |
|---|---|---|
| F40 | Buttons styled in two places (`<Button>` 186 uses, raw `btn-*` ~280 uses) | 55.1 |
| F41 | No ghost/quiet button class, no large size | 55.1 |
| F42 | ~107 hand-written link styles | 55.1 |
| F43 | `Drawer` appears instantly, no footer, two widths, plain header | 55.1 |
| F44 | `PanelFrame` is a second slide-over with a text "×" and its own focus handling | 55.1 |
| F45 | Focus rings inconsistent | 55.1 |

### 2.9 Buttons
| # | Recommendation | Batch |
|---|---|---|
| F46 | One source: `<Button>` uses the shared `.btn-*` classes | 55.1 |
| F47 | Variants primary, secondary, ghost, soft, danger; sizes sm, md, lg, touch; icon-only | 55.1 |
| F48 | Depth: top highlight, 1 px ring, soft hover glow | 55.1 |
| F49 | Press response (1 px, 98.5 %), off for reduced motion | 55.1 |
| F50 | Always-visible offset focus ring | 55.1 |
| F51 | Icon and keyboard-hint slots; spinner replaces the icon (no width jump) | 55.1 |
| F52 | One primary per screen (lint/test on page-level components) | 55.1 |
| F53 | Split button ("Save ▾ Save and hand in") | 55.1 |
| F54 | Sticky action bar on long forms | 55.1 |

### 2.10 Links
| # | Recommendation | Batch |
|---|---|---|
| F55 | `link`, `link-quiet`, `link-arrow` | 55.1 |
| F56 | External / new tab shows ↗ | 55.1 |
| F57 | Bare links in text styled automatically; sweep the 107 hand-made styles | 55.1 |
| F58 | Links navigate, buttons act (audit and fix misuse) | 55.1 |

### 2.11 Slide-over panels
| # | Recommendation | Batch |
|---|---|---|
| F59 | One `Drawer`; `PanelFrame`, Record sheet, canvas drawers, map drawer use it | 55.1 |
| F60 | Slide in ~220 ms, backdrop fades and blurs; stays mounted while leaving | 55.1 |
| F61 | Floating, 8 px from the edges, rounded, on desktop; full screen or bottom sheet with handle on phone | 55.1 |
| F62 | Header (title, description, close), scrolling body, sticky footer | 55.1 |
| F63 | Widths sm/md/lg/xl; "Open as page" | 55.1 |
| F64 | Every detail panel has its own address (indicator, evidence, activity, section) | 55.4 |
| F65 | Previous/next (J/K) through the list | 55.4 |
| F66 | Unsaved-changes warning on close | 55.1 |
| F67 | Stacked panels with back | 55.4 |
| F68 | Right to left: slides from the left in Arabic | 55.1 |

### 2.12 Modern touches
| # | Recommendation | Batch |
|---|---|---|
| F69 | Command palette (Ctrl-K): search + actions from one command table | 55.2 |
| F70 | Shortcut hints on hover; "?" lists all | 55.2 |
| F71 | Layout-shaped skeletons instead of spinners | 55.2 |
| F72 | Optimistic status changes, rolled back on refusal | 55.2 |
| F73 | Undo in the toast instead of "Are you sure?" for reversible actions | 55.2 |
| F74 | Hover cards for indicator, person, project | 55.2 |
| F75 | Row ⋯ menu, multi-select, bulk-action bar | 55.2 |
| F76 | One empty-state pattern (with F32) | 55.2 |
| F77 | One icon set (Lucide) | 55.1 |
| F78 | Quieter surfaces in the app (grid/glow only on the marketing site) | 55.1 |
| F79 | Five-step type scale, tight headings, tabular figures | 55.1 |
| F80 | Page crossfade (View Transitions where supported) | 55.2 |

### 2.13a Marketing site (owner decision 2026-11-14: in this phase)
| # | Finding | Recommendation | Batch |
|---|---|---|---|
| F85 | Marketing site uses a different visual language (grid/glow, saffron on spruce, heavy 900 weights) from the app | One brand and token table for both; marketing keeps a bolder hero but the same colours, type and buttons | 55.9b |
| F86 | Home page is long and dense; the product story is hard to scan | Hero (one sentence, one primary + one secondary action, product screenshot), proof strip, 3 outcome sections, sector strip, pricing teaser, final call to action | 55.9b |
| F87 | Navigation lists many pages (features, platform, solutions, compare, tour) that overlap | Nav: Product (mega-menu: features grouped by job), Solutions (sectors), Pricing, Security, Resources (support, tour); Sign in + Start free on the right | 55.9b |
| F88 | Screenshots show the old look | New screenshots from the 4.000 app (light, real-looking demo data), regenerated by a script so they never go stale | 55.9b |
| F89 | Sector pages repeat a template with little sector-specific proof | Each sector page: the kit's indicators, a sample dashboard picture, the matching template; drawn from the sector library data | 55.9b |
| F90 | Pricing page compares plans in prose | Plan cards + one comparison table with sticky header; FAQ; link to refunds | 55.9b |
| F91 | Sign-in, sign-up and invite pages look unlike both site and app | One split layout: form on one side, brand panel on the other; same inputs and buttons as the app | 55.9b |
| F92 | Legal and support pages are long walls of text | Readable column (≤ 72 characters), sticky table of contents, last-updated line from `LEGAL` | 55.9b |

### 2.13 Brand and page structure (owner decisions 2026-11-14)
| # | Finding / decision | Recommendation | Batch |
|---|---|---|---|
| F81 | The palette (saffron, spruce, green-grey slate) reads as a marketing look, not a corporate product | A complete new colour brand for app **and** marketing site: see §6 | 55.1 (app), 55.9b (site) |
| F82 | Sections on a page run together: cards, banners and tables of different weights stacked with no rhythm | One page anatomy and section component: see §7 | 55.1 (component), every later batch (pages) |
| F83 | The legacy report page (`ReportWorkspace`, used when Report Editor v2's flag is off) is a second way to generate and edit a report | Retire it: Report Editor v2 for every tenant, flag removed, `ReportWorkspace` and its views deleted after the route map shows nothing else uses them | 55.7 |
| F84 | The classic project form (`/projects/new/classic`) | Retire outright (owner decision): redirect to the wizard, delete the page and its components | 55.5 |

## 3. Batches

Each batch is shippable on its own and asks for the owner's go-ahead before it starts.

### 55.0 Baseline (no user-visible change)
- Route map `phase55-route-map.md` (all 155 routes, owner, target) and its test.
- Baseline screenshots per role (admin, PM, M&E, field officer, viewer, partner) at 1300/768/390 px, light and dark.
- Count clicks for ten key journeys (create project, record a value, import, verify, draft report, export, make a dashboard, map an indicator, invite, settings change) — the yardstick for "simpler".

### 55.1 Design system v4 (F38, F35, F40–F63 except F64/F65/F67, F66, F68, F77–F79, F81, F82)
- New colour brand (§6): tokens, Tailwind palette, chart roles (`chart-theme-roles.ts`), `--viz-*`, map colours, PDF/DOCX/infographic exports, emails, favicon and logo colours; contrast-tested light and dark.
- Page anatomy (§7): `PageHeader`, `Section`, `SectionGroup`, `Toolbar`; a test fails a portal page with two top-level cards and no section between them (checked on the server-rendered tree in the harness).
- Tokens: type scale, radii, elevation, motion (`MOTION` table extended), focus ring; mirrored in `globals.css` and `tokens.ts`, contrast-tested.
- Buttons, links, `Drawer`, `IconButton`, split button, sticky action bar, `Kbd`.
- Migrate `PanelFrame`, Record sheet, canvas drawers, map drawer to `Drawer`.
- Sweep raw link and button styles (codemod + review); test fails on a new hand-written link colour.
- Lucide icons; quieter app background; glossary + copy lint; "beta" on the language switcher.
- Harnesses: refresh `test:visuals`; new `test:ui-kit` (buttons, links, drawer: keyboard, RTL, reduced motion).

### 55.2 Interaction layer (F6, F30, F32, F33, F69–F76, F80)
- Command palette **with actions from the start** (owner decision): `COMMANDS` table (navigate, create, act: new activity, record a value, approve, verify, invite, export...); an action runs the same server action as its button, asks the same confirmation, and is offered only when `showsButton`/capabilities allow it; permission-filtered through the same capability tables; search API over projects, indicators, reports, files (new read-only route, in `RULES`, tenant- and membership-scoped).
- Toast v2 with Undo; reversible actions listed in one table.
- Skeleton per page layout; `SearchPicker`; `HoverCard`; `RowMenu` + bulk bar; `EmptyState`.
- Optimistic updates for plan status and checklist decisions first.

### 55.3 Navigation and Home (F1, F2, F3, F36, F37)
- Sidebar groups from `role-navigation.ts`; Home absorbs My Work; one Inbox (`/inbox`) over `AssignmentQueue` and notifications; old addresses redirect.
- **"Waiting to send" stays separate** (owner decision): the offline outbox keeps its own page and phone tab; the Inbox shows only a count linking to it.
- Field and partner navigation pinned and tested per role.

### 55.4 Project shell (F4, F5, F7, F64, F65, F67)
- Six tabs driven by a table (`PROJECT_TABS`), sub-pages nested; feature visibility from project facts.
- Breadcrumbs; detail panels with addresses (extend the plan's intercepting-route pattern), J/K, stacked panels.

### 55.5 Starting out (F8–F11)
- Retire `/projects/new/classic` (redirect, delete page and components; route map row).
- Wizard is the only entry; short path; rest becomes the setup checklist (from `SETUP_REQUIREMENTS`).
- "Get started" checklist replacing onboarding pages; Settings → Defaults.

### 55.6 Data entry and imports (F12–F17, F31, F34)
- Record sheet as the one entry; other screens open it. One Import page with type detection, template beside upload, on-screen row fixes (the parsers' checks unchanged).
- Simple review offered at sign-up; attach-then-verify; drafts on long forms; phone gaps.

### 55.7 Reports (F18–F21)
- Retire the legacy report page (F83): remove `isReportEditorV2Enabled` (always v2), delete `ReportWorkspace` and views only it uses, map old `?view=` addresses to editor panels (`LEGACY_VIEW_PANEL` already does this), check every tenant can open its existing drafts in v2 first (scripted read of every period).
- Period stepper, Next step button, Data tables rename, closing report as a type.

### 55.8 Visuals and maps (F22–F25)
- Visuals home, one chart editor, one "Add to dashboard", one-action indicator map.

### 55.9 Places, team, settings (F26–F29)
- Places owner, invite-with-projects, settings groups, AI page.

### 55.9b Marketing site (F85–F92)
- Same brand, tokens, buttons, links and section anatomy as the app (one stylesheet, one token table).
- Pages: home, features, platform, solutions + `solutions/[sector]`, compare, pricing, tour, security, contact-sales, signup/login/forgot/reset/invite, thanks, checkout, support centre, legal pages (terms, privacy, cookies, DPA, acceptable use, refunds, subprocessors), `maps/sources`, 404/error, Open Graph and Twitter images, favicon, manifest.
- Public copy stays honest: every claim still checked against the code (the `/security` and legal facts come from `LEGAL`); legal pages get the 4.000 version label and date at release.

### 55.10 Clean-up and release
- Remove unused redirects (F39), re-measure the ten journeys against 55.0, full suites, support articles and screenshots, AGENTS.md invariants, deploy (`SCOPE=both`).

## 4. Owner decisions (2026-11-14)
1. **Brand**: a comprehensive new, modern, professional, corporate colour brand: **Option A, Cobalt and Teal** (§6).
2. **Icons**: Lucide.
3. **Command palette**: search **and actions** from the first release.
4. **Inbox**: the offline "Waiting to send" list stays separate.
5. **Retire** the classic project form **and** the legacy report generation page (`ReportWorkspace`).
6. **Order**: 55.0 → 55.1 → 55.2 → 55.3 → … as listed.
7. **Sections must feel separated** on every page, never a mess (§7).

## 5. Not in this phase
- Business rule, permission or API changes beyond the read-only search route.
- Native review of translations (still owed separately).

## 6. The new colour brand (F81)

Direction: corporate and trustworthy (finance, health, development-bank feel), calm enough for dense data, distinct from
the old saffron. Three options were rendered for the owner on 2026-11-14 (`phase55-brand-options.html`). **Chosen: Option A, Cobalt and Teal.**

| Role | Value | Use |
|---|---|---|
| Primary | Cobalt `#1E40AF`; scale 50 `#EFF4FF`, 100 `#DBE6FE`, 200 `#BFD2FD`, 300 `#93B2FB`, 400 `#5F87F6`, 500 `#3B63EB`, 600 `#2849D4`, 700 `#1E40AF`, 800 `#1D358A`, 900 `#0F1B3D` | Primary buttons, active navigation, focus ring |
| Link | `#1D4ED8` (light), `#93B2FB` (dark) | Links |
| Navy | `#0F1B3D` | Sidebar, marketing hero, footer |
| Accent | Teal `#0D9488` (marketing call to action `#0D9488`, dark-mode tint `#5EEAD4`) | Highlights, marketing primary action, second chart colour |
| Ink / muted | `#0F172A` / `#5B6575` (light); `#E7ECF4` / `#9AA6B8` (dark) | Text |
| Canvas / surface / border | `#F6F7F9` / `#FFFFFF` / `#E3E6EB` (light); `#0B1220` / `#121A2B` / `#243049` (dark) | Page, sections, dividers |
| Signals | Success `#15803D`, warning `#B45309`, danger `#B42318`, info `#1D4ED8` | Status only, always with a word or icon |
| AI | Violet `#6D28D9` | AI-drafted content marker only |
| Data `--viz-1..8` | `#1E40AF`, `#0D9488`, `#D97706`, `#BE185D`, `#0284C7`, `#65A30D`, `#7C3AED`, `#64748B` (dark-mode variants derived and checked in 55.1) | Charts, maps, infographics |
| Type | IBM Plex Sans (UI and marketing), IBM Plex Mono (codes, figures in tables) — to confirm in 55.1; Arabic keeps Noto Sans Arabic | All text |

Deliverables: one token table (`tokens.ts`) feeding CSS variables, Tailwind and chart roles; a brand sheet page
(`/help/brand`, internal) showing every token and pair; logo and favicon recoloured; exports (PDF, DOCX, infographics,
emails) use the same tokens; saved charts that chose their own colours keep them; `test:visuals` pictures refreshed.
The marketing site uses the same palette in this phase (55.9b).

## 7. Page anatomy: sections that feel separated (F82)

Every portal page is built from the same parts, top to bottom:

1. **Page header** (`PageHeader`): breadcrumbs, title, one-line description, at most one primary action plus a ⋯ menu; a thin divider under it.
2. **Toolbar** (optional): filters, search, view switch, on one row; sticks under the header when scrolling.
3. **Sections** (`Section`): each has a heading (16 px semibold), an optional one-line description and its own actions on the right; content sits on one surface (a white panel with a 1 px border and 12 px radius), never cards inside cards.
4. **Spacing rhythm**: 32 px between sections, 16 px inside a section, 8 px between related controls; one max content width (1280 px) with wide pages (sheets, canvases, maps) opting out explicitly.
5. **Grouping**: related small sections sit in a `SectionGroup` grid (2 or 3 columns from 1024 px); a page never mixes free-floating cards and full-width tables at the same level.
6. **Weight order**: alerts/banners only at the top of the page or the top of the section they concern; one banner style per severity; at most one banner visible per section.
7. **Side detail** goes in the slide-over, not as an extra column squeezed into the page.
8. **Phones**: sections stack, headings stay, section actions move into the section's ⋯ menu.

Rules are pinned by tests where they can be (no nested `.card`, every page has one `PageHeader` and an `h1`, sections have
headings), and by the `test:visuals` pictures where they cannot. Each later batch (55.3–55.9) converts the pages it touches;
55.10 converts any left and fails the build on a portal page without `PageHeader`.

## 8. Implementation status (2026-11-14, second pass)

Deployed `20261114150000` (both) and `20261114180000` (web). Checked in a signed-in browser on production (admin account).

| Batch | Built | Still partial (reason) |
|---|---|---|
| 55.0 | Route map + `route-map.test.mts` | — (screenshots for all seven roles in `phase55-baseline/`, taken 2026-11-14 with ZZ TEST users `mnpiracha+zz-<role>@gmail.com`; still active, because the app has no way to switch a user off) |
| 55.1 | Brand everywhere, IBM Plex, buttons/links/Drawer/PanelFrame, page anatomy, SplitButton, Kbd, EmptyState v2, toasts v2, Lucide, quieter background, tables v4, glossary + `ux-glossary.test.mts` (F38), one primary per page (F52, fixed offenders), "beta"-free copy | F58 link/button misuse: reviewed by hand while converting pages, no automatic rule |
| 55.2 | Command palette (search + actions + shortcuts), Undo toasts, layout skeletons (F71), optimistic plan status (F72), HoverCard (F74), RowMenu (F75), page crossfade (F80) | — (F75: floating `SelectionBar`; bulk actions already existed for evidence, checklist, activities and plan) |
| 55.3 | Four groups, hubs, Inbox, field nav, partner landing (F37) | — |
| 55.4 | Project tabs, "More", breadcrumbs, J/K in the plan panel (F65) | — (F67: `Drawer` keeps a stack; lower panels step back, the top one has Back) |
| 55.5 | Classic form retired, wizard short path "Only what is still needed" (F9), Get started checklist with progress (F10), Settings › Data defaults (F11) | — |
| 55.6 | One Import page, templates beside uploads, on-screen fixes (F15), simple review chosen in the wizard's review step (F16), form drafts (F31), GPS "Here" (F34); Enter data and Record share `quickEnterValueAction` (F12) | — (F17: `AttachAndVerify` panel from "Verify all") |
| 55.7 | Legacy report retired, stepper + one Next step on report/inputs/export (F18/F19), Data tables (F20), final report from New report (F21) | — |
| 55.8 | Visuals home + Tools, quick chart links to the Chart Studio (F23), map from an indicator via the Map button (F25, Phase 53) | — (F24: `AddToDashboard` used by the Data Center, Chart Studio and maps) |
| 55.9 | Settings groups, AI page, Places pointer (F26), invite with projects for everyone (F27) | — |
| 55.9b | Site tokens/fonts/hero, five-entry nav, shorter home, AuthFrame, legal contents, sector pages from the library (F89), sticky pricing table (F90) | Screenshot script (F88): the site uses drawn illustrations, not screenshots |
| 55.10 | AGENTS.md, route map, tests | Remove redirects after one release (F39) |

## 9. After the plan (2026-11-15)
- **Team members**: Deactivate, Reactivate and Delete buttons (AGENTS.md, Version 4.000 invariants). Deployed `20261115090000`; used on production to clean up the seven role-screenshot users.
- **Deploy script**: always re-links the api's dependencies on the host (a rolled-back deploy, `20261114230000`, was caused by stale links).
- **Left over by design**: redirects removed after one release (F39); `ZZ Test Field/Partner/PM` users from earlier sessions are still on the Team page; one pending invitation to `mnpiracha+zz-pm@gmail.com` exists from the re-invite check (the app has no "cancel invitation" button yet).
- **Support and memory bank (2026-11-15)**: every support article was reviewed against the new layout (about 85 changed; four added: find your way around, datasets, choose where you work, record figures by place; `apps/web/content/support/INDEX.md`, `memorybank/docs/support/ux-4000-map.md`). The memory bank was brought up to date: `Features/66-New-UX-Version-4.md` (new), a Version 4.000 note on 16 feature docs, `INDEX.md`, `Features/INDEX.md`, `features.md`, `pending.md`, `Fixes.md`, `CONTABO-DEPLOY.md`, `contabo-ops.md`, two runbooks, the marketing inventory and changelog, and `docs/support/README.md` (mirror synced).
- **Items marked partial in §8 that were built afterwards** (second and third pass, 2026-11-14): bulk selection bar (F75), stacked panels (F67), one Add-to-dashboard control (F24), attach-then-verify (F17), role screenshots (55.0), partner Home (F37). All of §2 is now built except F39 (waits one release), F58 and F52 as automatic rules, and F88 (the site uses drawn illustrations).

## 10. Closing checks (2026-11-15)
- Checked live on production (signed-in admin): evidence selection bar; **Attach the files** on a throwaway project ("ZZ TEST v4 checks", made with the wizard, evidence required, value handed in, Verify all → toast → panel → "File attached and value verified"); form-draft restore; GPS **Here** (location filled from the browser's position); wizard **Only what is still needed** (Next from slide 1 skipped the completed slide 2); Arabic: eleven screens are right to left with no sideways scroll.
- Fixed from these checks: the wizard gap "The MONTHLY report needs…" now names the report in words (all four languages); three labels still said "report workspace" (the glossary test now reads JSX text across lines and caught them); the Version 4 navigation (project tabs and pages, Settings list, hub tabs, search box, Academy) is translated (`features/i18n/domain/ui-labels.ts`).
- Test data archived: the ZZ TEST project and the two ZZ-TEST evidence files on DEMO-15.

