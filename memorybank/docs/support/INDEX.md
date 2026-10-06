# DonorDesk Support Documentation Index

Source files for the public Support Center at donordesk.online/support. Each file is routed from `apps/web/src/app/support/<category>/[article]/page.tsx` (see `FILE_MAP`) and listed in `apps/web/src/components/support/wikiCategories.tsx`. **When you add, rename or remove an article, update both.** Last full refresh: 2026-10-07; corrected after demo 5 (2026-10-06).

## Ground truth to check when editing

- Plans and limits: `packages/domain/src/contexts/billing/plan.ts` (Starter $0, Team $129, Growth $299, Enterprise contracted; AI drafts 5 / 20 / 100)
- Roles and permissions: `packages/domain/src/policies/permissions.ts`
- Labels and statuses: `apps/web/src/lib/labels.ts`
- Report editor: `apps/web/src/features/report-editor/`
- Email delivery is not active in production, so invitations are shared as links and notifications are in-app only.
- There is no public API, two-factor authentication, donation/CRM module, custom fields or in-app account deletion. Do not document them.

## Getting Started (`basic-information/` and `basic-information-*.md`)
what-is-donordesk, getting-started-overview, key-concepts, understanding-projects, understanding-logframes, logframe hierarchy, indicators and targets, understanding-evidence, evidence verification, understanding-activities, reporting periods, compliance checklist, report sections / statuses / readiness / workflow, audit logs, donor templates, storage and file management, AI in DonorDesk, data security, user roles and permissions, pricing plans.

## How-To (`how-to/`)
Accounts: log-in, create-an-account, change-your-password, set-up-new-organisation, change-organisation-profile, invite-team-members, manage-team-roles-permissions, onboard-team-member.
Projects: create-a-project, archive-a-project, build-logframe, upload-donor-template, connect-google-drive.
Reporting: run-a-reporting-month, create-a-reporting-period, create-the-closing-report, review-and-accept-activities, fix-or-remove-an-indicator, change-a-reports-template, update-indicator-values, import-from-google-sheets, log-activities, upload-evidence, tell-the-story-and-add-inputs, generate-ai-report-draft, use-the-report-editor, review-and-approve-reports, export-reports, use-compliance-checklist, use-bulk-actions, use-comments-feedback, use-the-audit-trail, prepare-for-donor-visit.
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
