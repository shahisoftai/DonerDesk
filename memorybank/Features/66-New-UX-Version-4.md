# 66 — The new UX (Version 4.000): one brand, fewer doors, clearer pages

**DonorDesk Version 4.000 (Phase 55)**
**Status:** built and deployed 2026-11-14 (releases `20261114150000` both, `20261114180000` web, `20261114200000` web, `20261115090000` both after a rolled-back attempt `20261114230000`); checked in a signed-in browser on production (admin account, plus seven short-lived test users, one per role, for screenshots).
**Plan and build record:** [`../imp/phase55-new-ux.md`](../imp/phase55-new-ux.md) (findings F1–F92, batches 55.0–55.10, owner decisions §4, brand §6, page anatomy §7, status §8–§9). **Route map:** [`../imp/phase55-route-map.md`](../imp/phase55-route-map.md). **Brand options shown to the owner:** [`../imp/phase55-brand-options.html`](../imp/phase55-brand-options.html). **Rules:** `AGENTS.md` → "Version 4.000 invariants". **Support text:** [`../docs/support/ux-4000-map.md`](../docs/support/ux-4000-map.md) (the navigation map every article follows) and `apps/web/content/support/how-to/how-to-find-your-way-around.md`.
Builds on [60](60-Record-One-Data-Entry-Flow.md), [62](62-Visual-Studio.md) and [65](65-Datasets-And-Kits.md). 3.007 is tagged `v3.007`; the version label in the living documents is 4.000.

## What a person gets

| Area | What changed |
|---|---|
| **Look** | Cobalt and Teal brand (option A of three shown to the owner), IBM Plex Sans/Mono, cool slate neutrals, a navy left rail, one button system (`btn-primary/secondary/ghost/soft/danger`, sizes sm–touch, icon), one link system (`link`, `link-quiet`, `link-arrow`), Lucide icons, quieter background, tables and toasts restyled. Charts, maps, exports, share images and the marketing site use the same colours. |
| **Slide-over panels** | One `Drawer` for every panel: slides in (220 ms), floats 8 px from the edge on desktop, sticky footer, "Open as page", asks before discarding changes, right-to-left aware, **stacks** (the lower panel steps back; the top one has Back and owns Esc and focus). The plan's panel route (`PanelFrame`) uses the same surface and has J/K previous-next. |
| **Page anatomy** | `PageHeader` (breadcrumbs, title, description, ≤ 1 primary action), `Toolbar`, `Section` (heading + one surface), `SectionGroup`, `StickyActions`; `.page-stack` (32 px between sections), `.page-title`, `.section-title`. About 100 pages converted. |
| **Navigation** | Left rail in groups **Work** (Home, Inbox, Projects, Dashboards and infographics), **Report** (Reports, Programmes and grants), **Admin** (Team, Settings). Hubs: Portfolio is a tab of Home; Evidence, Compliance and Download Center are tabs of Reports (a field officer keeps Evidence). My Work and Notifications are the **Inbox** (To do, Team, Updates); "Waiting to send" stays its own page. Partners get a **Your projects** Home. |
| **Project** | Seven tabs (Overview, Plan, Data, Evidence, Reports, Finance, Settings) from one table; a second row shows the pages inside; rare pages (and Forms/Datasets until the project has one) sit under **More**; breadcrumbs. |
| **Command palette** | Ctrl/⌘ K: find projects and files, jump to pages, run actions (create a project, record, invite…), all filtered by the person's capabilities. "?" lists the shortcuts; G + letter goes to a page; R opens Record. Stands down where a screen has its own (report text editor, design editor, a report page). |
| **Settings** | A grouped side list (Organisation, Data defaults, AI, Security, Billing, Integrations) instead of a row of tabs; one **AI features** page. |
| **Visuals** | Designs as cards, Templates and Datasets tabs, one **Tools ▾** menu (Chart Studio, Maps, Images and brand, Data alerts, TV display). One shared **Add to a dashboard** control. |
| **Reports** | One report page (Report Editor v2); the legacy workspace and `?editor=classic` are retired. A four-stage bar **Inputs → Story → Draft → Review and export** with one next-step button on the report, inputs and export pages. "Final (closing) report" is a button on New report. "Report builder" is now **Data tables**. |
| **Starting out** | The classic one-page project form is retired; the wizard has **Only what is still needed**; onboarding is **Get started** with a progress bar. |
| **Data entry** | **Attach the files** panel from "Verify all" (upload → verify → verify the value in one step); a floating **selection bar** for bulk verify; form drafts kept on the device (new report, planned activity); **Here** (GPS) on the activity form; on-screen import fixes; invite anyone with projects. |
| **Team** | **Deactivate**, **Reactivate** and **Delete** per member (`SetUserStatusHandler`, `POST /v1/users/:id/status`). |
| **Marketing site** | Same brand and fonts, five-entry menu, shorter home, one sign-in frame, legal pages with a sticky contents list, sector pages list the sector library's headline indicators, sticky pricing table header. |

## Rules (the ones a future change must keep)

- Brand values live in one table (`features/design/domain/tokens.ts`) mirrored in `globals.css`, Tailwind `brand/slate/accent`, chart roles (`chart-theme-roles.ts`) and `CHART_PALETTES[0]`; contrast is tested (`design-tokens.test.mts`). Never hard-code a brand colour.
- Navigation is a table: `role-navigation.ts` (`NAV_ENTRIES`, `NAV_HUBS`, `hubTabsFor`, `sidebarHrefFor`), `project-tabs.ts` (`PROJECT_TABS`, `locateProjectPage`, `subNavFor`, `projectCrumbs`), `features/command/domain/commands.ts`. A new page is a row there and in `phase55-route-map.md` (`route-map.test.mts` fails otherwise and fails a link to a REDIRECT address). `ux-glossary.ts` + `ux-glossary.test.mts` fail a retired word (My Work, Report builder, Report workspace, classic form) in a user-visible string.
- Delete a team member: the account becomes `REMOVED`, memberships end, name and email are replaced, records stay as "Removed user"; the audit row never repeats the person's details; the last active administrator cannot be removed; nobody acts on their own account. A removed user is hidden from the Team list.
- A screen with its own keyboard handling says so (`document.body.dataset.ownPalette`) so the app-wide keys stand down; the report text editor keeps Ctrl K for links.
- The deploy script now regenerates the api's dependency links on the host on every api ship (see Fixes 2026-11-15).

## Where it lives

| Concern | Code |
|---|---|
| Brand and tokens | `apps/web/src/features/design/domain/tokens.ts`, `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx` (fonts), `components/site/site.css` + `fonts.ts` |
| Shared parts | `components/ui/{Button,IconButton,SplitButton,RowMenu,HoverCard,SelectionBar,FormDraftKeeper,HereButton}.tsx`, `components/feedback/{Drawer,PageState,Toast}.tsx`, `components/layout/{AppShell,SideNav,HubTabs,Page,AuthFrame,nav-icons}.tsx` |
| Navigation | `features/navigation/domain/role-navigation.ts`, `features/projects/domain/project-tabs.ts`, `features/projects/presentation/ProjectNav.tsx`, `app/(portal)/inbox/`, `app/(portal)/settings/layout.tsx`, `features/settings/presentation/SettingsNav.tsx` |
| Palette | `features/command/{domain/commands.ts,presentation/CommandPalette.tsx}`, `lib/actions/search.ts` |
| Reports | `features/reporting/presentation/{ReportStepper,PeriodStepper,AttachAndVerify}.tsx` |
| Visuals | `features/dashboards/presentation/AddToDashboard.tsx`, `features/visual-studio/presentation/ShellTabs.tsx` |
| Team | `packages/application/src/use-cases/identity/user-status.ts`, `apps/api/src/routes/users.ts`, `features/team/presentation/TeamPanel.tsx` |
| Partner Home | `features/dashboard/presentation/PartnerHome.tsx` |

## Verification

- Browser (production, admin): Home, Inbox, Projects, a project's seven tabs and their sub-pages and More menus, a report, Finance, Settings and its list, AI features, Visuals, Datasets, Where we work, Team (deactivate, reactivate, delete, re-invite), command palette (projects, files, shortcuts), phone width (no sideways scroll). Seven role screenshots (Home, project, Inbox, phone) in [`../imp/phase55-baseline/`](../imp/phase55-baseline/).
- Tests: web unit suite (1033 at the first run; route map, glossary, design tokens, navigation), Chart Studio harness (all but one language check, a harness limit), API authorization coverage, three user-status handler tests.
- Not browser-checked: the evidence **selection bar** (the demo project has no files awaiting verification), the **Attach the files** panel, stacked panels, form-draft restore, the GPS button on a phone, the wizard's **Only what is still needed**, Arabic right-to-left on the new screens. Translations of the new strings are drafts without native review.

## Known gaps

- Redirects from the old addresses (`/my-work`, `/notifications`, `/projects/new/classic`) are kept for one release (F39).
- The seven short-lived role test users were deleted; three older test users (`ZZ Test Field/Partner/PM`) and one pending invitation (`mnpiracha+zz-pm@gmail.com`) remain; the app has no "cancel invitation" button yet.
- No automatic rule for "link vs button" misuse (F58) or for "one primary button per page" (F52); both were fixed by hand while converting pages.
- A billing test still expects plan catalog version 3 (the catalog is 4); unrelated to this phase.
