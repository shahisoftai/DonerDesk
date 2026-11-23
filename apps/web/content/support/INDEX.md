# DonorDesk Support Documentation Index

Source files for the public Support Center at donordesk.online/support. Each file is routed from `apps/web/src/app/support/<category>/[article]/page.tsx` (see `FILE_MAP`) and listed in `apps/web/src/components/support/wikiCategories.tsx`. **When you add, rename or remove an article, update both.** Data Center, report charts and reopening added 2026-10-15; Chart Studio how-to (50 chart types, 40 themes, style options) added 2026-11-09; **last full refresh: 2026-11-15 for Version 4.000** (every article reviewed against the new navigation, `memorybank/docs/support/ux-4000-map.md`; checked in a signed-in browser on production: left menu, project tabs and More menus, Settings list, Reports tabs, Record menu, Team page, Datasets, Where we work, Work plan, Report inputs); earlier refresh 2026-11-12 (browser audit: wizard, Record, Report inputs, Finance, Bring in data, Home, Visuals); corrected after demo 5 (2026-10-06).

## Version 4.000 naming (use these words)
The left menu is **Home, Inbox, Projects, Dashboards and infographics, Reports, Programmes and grants, Team, Settings**. **My Work** and **Notifications** are the **Inbox** (To do, Team, Updates). **Portfolio** and **Where we work** are tabs of Home; **Evidence, Compliance, Download Center** are tabs of Reports. A project has seven tabs: **Overview, Plan** (Results framework, Work plan, Where we work), **Data** (Data Center, Enter data, Import, Forms, Datasets; More: Data tables, Charts, Maps), **Evidence, Reports** (Reports, Donor templates, Compliance; More: Infographics), **Finance, Settings** (Project settings, Team, Setup). Settings has a grouped list (General, Workspace setup, Finance, Starting answers, Sector library, Donor requirements, AI features, AI usage, Writing style, Sign-in and two-step, Audit log, Plan and billing, API keys and webhooks). The Report builder is **Data tables**. **Ctrl K** is search and actions. The classic project form and the classic report view no longer exist. Full map: `memorybank/docs/support/ux-4000-map.md`.

## Ground truth to check when editing

- Plans and limits: `packages/domain/src/contexts/billing/plan.ts` (Starter $0, Team $79, Growth $149, Enterprise contracted; AI drafts 5 / 20 / 100)
- Roles and permissions: `packages/domain/src/policies/permissions.ts`
- Labels and statuses: `apps/web/src/lib/labels.ts`
- Report editor: `apps/web/src/features/report-editor/`
- Email delivery is not active in production, so invitations are shared as links and notifications are in-app only.
- Built and documented: work plan, collection forms and field app, maps, dashboards, infographics, Ask DonorDesk (opt-in), read-only API/webhooks/MCP, KoboToolbox/SurveyCTO connectors, two-step sign-in (optional, can be required), interface languages, the sector library (30 sectors, about 280 indicators; all unreviewed until an organisation reviews them), the Visual Studio (one shell for designs, charts, maps, templates, alerts; drill, motion, email updates) and the Chart Studio (50+ chart types, 40 themes, over 100 style options; error bars, word clouds and the population pyramid are deliberately not offered). There is no donation/CRM module and no in-app account deletion. Do not document them.

## Getting Started (`basic-information/` and `basic-information-*.md`)
what-is-donordesk, getting-started-overview, dashboards and infographics (basic-information-dashboards-and-infographics.md), key-concepts, understanding-projects, understanding-logframes, logframe hierarchy, indicators and targets, understanding-evidence, evidence verification, understanding-activities, reporting periods, compliance checklist, report sections / statuses / readiness / workflow, audit logs, donor templates, storage and file management, AI in DonorDesk, data security, user roles and permissions, pricing plans.

## How-To (`how-to/`)
Accounts: log-in, create-an-account, change-your-password, set-up-new-organisation, change-organisation-profile, invite-team-members, manage-team-roles-permissions, onboard-team-member.
Projects: create-a-project, archive-a-project, build-logframe, upload-donor-template, connect-google-drive.
Entering data (added 2026-11-12): record-data (the Record button), bring-in-data, track-reports-and-downloads (Reports list and Download Center).
Finance and settings (added 2026-11-12): use-the-finance-tab, set-up-finance-for-your-organisation, set-up-your-places-list, write-your-own-starting-answers.
Reporting: project-walkthrough, run-a-reporting-month, create-a-reporting-period, create-the-closing-report, review-and-accept-activities, fix-or-remove-an-indicator, change-a-reports-template, update-indicator-values, use-the-data-center, use-the-chart-studio, add-a-chart-to-a-report, reopen-an-approved-report, import-from-google-sheets, log-activities, dictate-instead-of-typing, work-offline-and-take-photos, upload-evidence, tell-the-story-and-add-inputs, generate-ai-report-draft, use-the-report-editor, review-and-approve-reports, export-reports, use-compliance-checklist, use-bulk-actions, use-comments-feedback, use-the-audit-trail, prepare-for-donor-visit.
Maps (updated 2026-11-10, Phase 49): see-your-work-on-a-map, pin-a-place-on-the-map (now also pins existing places and marks facilities), upload-your-own-map-boundaries, analyse-places-on-a-map, use-context-layers-on-a-map, download-places-and-map-results, keep-a-map-for-offline-use.
Navigation: **find-your-way-around** (new, Version 4.000 map and where things moved), use-the-dashboard (Home and the Inbox), search-projects-and-evidence (Ctrl K), use-the-notification-system (Inbox Updates), use-the-academy-tour, manage-billing-subscription.
Added 2026-11-15: **use-datasets** (bring in a table and chart it), **choose-where-you-work** (Plan → Where we work), **record-figures-by-place** (record by place and the map).
Updated 2026-11-16 (Phase 58): **report-readiness** (why indicators are not reportable), **start-a-dashboard-from-a-template** (create once, Open it); **create-a-project** (Use suggested settings for all on the Indicators slide, sheets read best, "request timed out" advice, Setup says why indicators are not reportable), **collect-answers-with-a-form** (Delete this draft), **import-your-plan** (Repeats in the wizard), **project-walkthrough** (suggested settings), **troubleshooting-project-setup** (request timed out, repeats, "reportable of"); also Repeats and the five-file limit in **create-a-project**.
Updated 2026-11-16 (Phase 57): **record-figures-by-place** (start from a place; By place sheet; Excel by place), **record-data** (Everything at a place), **update-indicator-values** (By indicator / By place), **use-the-field-app-offline** (place entry offline; what the download holds).

## Troubleshooting
login, account access, billing, browser performance, data recovery, project setup, logframe, indicator data, evidence upload, report generation, AI report generation, export, storage, dashboard, compliance checklist.

## Advanced Features
ai-settings (AI + AI Writing Style), data-import-export, multiple-donors, compliance-automation, roles-and-permissions, team-management, imported-vs-linked-data, templates.

## Account & Billing / Security & Privacy
plans-and-limits, invoices; security-best-practices, data-handling, gdpr-compliance.

## Reference (`/support/<slug>`)
contact, reference-faq, reference-glossary, reference-file-formats, reference-error-codes, reference-keyboard-shortcuts, reference-donor-reporting-guidelines.

## Report Writing Skills (`report-writing-skills/`)
Fundamentals, donor-specific guides (UNHCR, DG ECHO, USAID, Global Fund, GCF, FCDO, EU, Gates) and tools. These are donor-craft guidance and mention DonorDesk only where a feature is relevant.

## Unpublished (Phase 28 work plan)
`_unpublished-phase28/` holds nine draft how-tos and references (plan your activities, the timeline, My week, import your plan, asking for work and My Work, problems and risks, comments and files, daily summary and reminders, progress and one-step Done, dependencies/budget/people reached) and a README with the exact edits to apply to existing articles. The features are **deployed**, but the articles are not public yet: they wait for a live browser check with the owner's account. They are not routed, not in `FILE_MAP`, not in `wikiCategories.tsx`. Publish them, and make those edits, once that check passes (checklist in that README).

## Unpublished (batch 3, 2026-10-21)
`_unpublished-batch3/` holds nine drafts (framework history, programmes and grants, outside partners, taking your data with you, donor requirements, report locks, sign-in and passwords, AI usage and cost, files that could not be read) and a README with the publish checklist. The features are deployed; the articles wait for a browser check on the live site.
Updated 2026-11-23 (Phase 63c): review-evidence, user-roles-and-permissions and do-your-field-work-on-your-phone (a field officer opens no one else's sensitive files; the offline download holds only their own places; the server refuses routes outside their work).
Added 2026-11-23 (Phase 63): **do-your-field-work-on-your-phone** (a field officer's Home, Given to you, filling a form, Record, what is not shown). Updated the same day: run-a-facility-assessment (assessors choose only their given facilities), use-the-field-app-offline, user-roles-and-permissions and roles-and-permissions-in-depth (the field officer's view; money and analysis views), find-your-way-around, invite-team-members (one address, one organisation), sign-in-passwords-and-lockout (the reset email link).
Added 2026-11-22 (Phase 62): **run-a-facility-assessment** (facility forms, sections, tables, repeats, assignments, drafts, score, compare, kits, reading a Word or Excel tool).
