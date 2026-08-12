# DonorDesk — Global Light/Dark Theming Implementation

**Status:** Deployed to production (DonerDesk.online), release `20260812163749`
**Date:** 2026-08-12

## 1. Overview

Global light/dark color scheme across the entire web application — Dashboard,
all project pages (activities, evidence, logframe, reports, templates,
compliance), team, auth pages (login, signup, logout), forms, and tables. The
dark theme takes visual inspiration from the marketing front page
(`apps/web/src/app/page.tsx`): slate-950 base with brand-blue → cyan gradients,
glassmorphism, ambient glow, and a subtle tech-grid backdrop.

## 2. Theme infrastructure

| Concern | Where | What |
|---|---|---|
| Dark mode strategy | `apps/web/tailwind.config.ts` | `darkMode: "class"`; added `accent` cyan palette, glow shadows (`shadow-glow`), `animate-fade-in` |
| Design tokens | `apps/web/src/app/globals.css` | CSS variables in `:root` (light) and `.dark` (dark) for background, surface, border, text, glow, grid-line |
| Page backdrop | `globals.css` | `body::before` ambient brand/cyan radial glow; `body::after` 48px tech-grid with radial mask — applied on every page |
| Component classes | `globals.css` | `.btn`, `.btn-secondary`, `.btn-danger`, `.card`, `.input`, `.label`, `.tag*`, `.table-shell`, `.thead`, `.trow` are theme-aware (glass cards, gradient primary buttons) |
| No-FOUC script | `apps/web/src/components/ThemeScript.tsx` | Inline script in `<body>` sets `.dark` on `<html>` before hydration from `localStorage` or `prefers-color-scheme` |
| Toggle | `apps/web/src/components/ThemeToggle.tsx` | Sun/moon icon button; persists to `localStorage["donordesk-theme"]`; respects system preference; toggles `.dark` on `<html>` |
| Wiring | `apps/web/src/app/layout.tsx` | `suppressHydrationWarning` on `<html>`; `ThemeScript` mounted; `color-scheme` set per theme |

## 3. Dashboard redesign (`apps/web/src/app/dashboard/page.tsx`)

- Sticky glass top bar: logo mark, organization name, **light/dark toggle**,
  and New project / Team / Log out actions.
- KPI stat cards with gradient icon tiles, animated progress bars, and an
  urgent (amber/red) variant for reports due within 30 days.
- **Workspace health ring** — SVG conic-gradient ring (brand → cyan stroke,
  cyan glow drop-shadow) computing a derived health score from active projects,
  on-track ratio, and average days remaining.
- Recent project cards with gradient deadline progress bars; glass
  notification list with status tags.

## 4. Coverage across the app

Every page now renders correctly in both themes via the shared component
classes plus targeted `dark:` variants:

- Projects: list, new, detail (incl. tab bar and stat cards)
- Activities: list, new
- Evidence: library (table), upload
- Logframe: hierarchy, indicators table, add item
- Reports: period list, new period, workspace (readiness bar, checklist, exports)
- Templates: list, upload, section editor
- Compliance, Team (table), Logout
- Auth: Login, Signup (toggle placed top-right on pre-auth pages)

The marketing landing page (`app/page.tsx`) intentionally stays always-dark,
matching DonerDesk.online.

## 5. Deployment (2026-08-12, release `20260812163749`)

- Frontend-only change; no Prisma migration required.
- Web standalone built locally with `NEXT_PUBLIC_API_URL=/api` (same-origin
  browser calls through OLS `/api` proxy) and smoke-tested on a temp port.
- Release assembled on Contabo under `/opt/donordesk/releases/20260812163749`
  (unchanged `api/` + `prisma/` copied from previous release; new `web/`
  standalone with `.next/static` copied into the standalone layout).
- `current` symlink atomically switched; `donordesk-web` restarted;
  `donordesk-api` untouched and healthy.
- Verified: loopback 200 on `/`, `/login`, `/signup`; public HTTPS 200 on all
  pages; theme script + toggle aria-label served; dark-variant CSS present in
  production CSS chunks (`html.dark`, both theme tokens).
