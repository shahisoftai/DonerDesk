# DonorDesk Support Documentation Index

Source files for the public Support Center at donordesk.online/support. Each file is routed from `apps/web/src/app/support/<category>/[article]/page.tsx` (see `FILE_MAP`) and listed in `apps/web/src/components/support/wikiCategories.tsx`. **When you add, rename or remove an article, update both.** Data Center, report charts and reopening added 2026-10-15; Chart Studio how-to (50 chart types, 40 themes, style options) added 2026-11-09; last full refresh: 2026-10-07; corrected after demo 5 (2026-10-06).

## Ground truth to check when editing

- Plans and limits: `packages/domain/src/contexts/billing/plan.ts` (Starter $0, Team $79, Growth $149, Enterprise contracted; AI drafts 5 / 20 / 100)
- Roles and permissions: `packages/domain/src/policies/permissions.ts`
- Labels and statuses: `apps/web/src/lib/labels.ts`
- Report editor: `apps/web/src/features/report-editor/`
- Email delivery is not active in production, so invitations are shared as links and notifications are in-app only.
- Built and documented: work plan, collection forms and field app, maps, dashboards, infographics, Ask DonorDesk (opt-in), read-only API/webhooks/MCP, KoboToolbox/SurveyCTO connectors, two-step sign-in (optional, can be required), interface languages, the sector library (30 sectors, about 280 indicators; all unreviewed until an organisation reviews them), the Visual Studio (one shell for designs, charts, maps, templates, alerts; drill, motion, email updates) and the Chart Studio (50+ chart types, 40 themes, over 100 style options; error bars, word clouds and the population pyramid are deliberately not offered). There is no donation/CRM module and no in-app account deletion. Do not document them.

## Getting Started (`basic-information/` and `basic-information-*.md`)
what-is-donordesk, getting-started-overview, key-concepts, understanding-projects, understanding-logframes, logframe hierarchy, indicators and targets, understanding-evidence, evidence verification, understanding-activities, reporting periods, compliance checklist, report sections / statuses / readiness / workflow, audit logs, donor templates, storage and file management, AI in DonorDesk, data security, user roles and permissions, pricing plans.

## How-To (`how-to/`)
Accounts: log-in, create-an-account, change-your-password, set-up-new-organisation, change-organisation-profile, invite-team-members, manage-team-roles-permissions, onboard-team-member.
Projects: create-a-project, archive-a-project, build-logframe, upload-donor-template, connect-google-drive.
Reporting: project-walkthrough, run-a-reporting-month, create-a-reporting-period, create-the-closing-report, review-and-accept-activities, fix-or-remove-an-indicator, change-a-reports-template, update-indicator-values, use-the-data-center, use-the-chart-studio, add-a-chart-to-a-report, reopen-an-approved-report, import-from-google-sheets, log-activities, dictate-instead-of-typing, work-offline-and-take-photos, upload-evidence, tell-the-story-and-add-inputs, generate-ai-report-draft, use-the-report-editor, review-and-approve-reports, export-reports, use-compliance-checklist, use-bulk-actions, use-comments-feedback, use-the-audit-trail, prepare-for-donor-visit.
Maps (updated 2026-11-10, Phase 49): see-your-work-on-a-map, pin-a-place-on-the-map (now also pins existing places and marks facilities), upload-your-own-map-boundaries, analyse-places-on-a-map, use-context-layers-on-a-map, download-places-and-map-results, keep-a-map-for-offline-use.
Navigation: use-the-dashboard, search-projects-and-evidence, use-the-notification-system, use-the-academy-tour, manage-billing-subscription.

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

