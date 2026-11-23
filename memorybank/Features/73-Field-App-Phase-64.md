# Field app — Phase 64 (DonorDesk Version 4.01, 2026-11-23)

A field officer on a phone lands in `/field` after signing in. The page is client-only (kept for offline use by the service worker); everything it shows comes from the work downloaded to the phone.

- **Screens:** Today (greeting, summary, **Do this next**, visits, planned work, other forms), My week, Waiting, Me. Bottom tab bar (hidden while filling a form). First time: one card and one button (**Get my jobs**) that downloads every project.
- **Pure logic** (`features/offline/domain/field-today.ts`): `buildToday`, `weekGroups`, `dueOf`. Rank: started, overdue, today, soon, later. No clock inside (today is passed in).
- **Landing:** `landsInFieldApp` (`navigation/domain/phone-landing.ts`): FIELD home variant + phone user agent + not `?stay=1` + not external. "Open the online home page" adds `?stay=1`.
- **Install:** `public/manifest-field.webmanifest` ("DonorDesk Field", start `/field`).
- **Copy:** `fa.*` keys (`messages/field-{en,fr,es,ar}.ts`), number-neutral. Drafts without native review. The glossary retires "my work": the buttons say **Get my jobs / Refresh my jobs**.
- **Forms:** photos are shrunk in the browser before upload; on a phone the section contents is a pull-down (`SectionNav`) so the questions stay on screen.
- **Checks:** `pnpm --filter @donordesk/web test:field-app` (Chromium, phone viewport, 12 checks, screenshots in `tests/harness/field-app/shots`), `tests/unit/field-today.test.mts`; live check 2026-11-23 as the field officer on production.
- Deploy: web only, no migration.
- Open: real-phone and real signal-loss test (owner); native review of translations; the dev browser keeps a desktop user agent, so the redirect was proven with a phone-UA request, not seen in the window.
