# Phase 55 route map (Version 4.000)

**DonorDesk Version 4.000** · generated 2026-11-14 from `apps/web/src/app/**/page.tsx` · read by `apps/web/tests/unit/route-map.test.mts`

Every page has one row. `KEPT` pages stay at their address (possibly under a new tab or menu); `REDIRECT` pages answer with a
redirect to the target and must never be linked from the app. A new page needs a row, or the test fails.

| Route | Owner in 4.000 | Status | Target |
|---|---|---|---|
| `/` | Marketing site | KEPT |  |
| `/acceptable-use` | Marketing site | KEPT |  |
| `/checkout` | Marketing site | KEPT |  |
| `/collect/[token]` | Public link / field | KEPT |  |
| `/compare` | Marketing site | KEPT |  |
| `/contact-sales` | Marketing site | KEPT |  |
| `/cookies` | Marketing site | KEPT |  |
| `/dpa` | Marketing site | KEPT |  |
| `/embed/canvas/[token]` | Public link / field | KEPT |  |
| `/embed/dashboard/[token]` | Public link / field | KEPT |  |
| `/features` | Marketing site | KEPT |  |
| `/field` | Public link / field | KEPT |  |
| `/forgot-password` | Auth (AuthFrame) | KEPT |  |
| `/invite/accept` | Auth (AuthFrame) | KEPT |  |
| `/login` | Auth (AuthFrame) | KEPT |  |
| `/logout` | Auth (AuthFrame) | KEPT |  |
| `/maps/sources` | Marketing site | KEPT |  |
| `/platform` | Marketing site | KEPT |  |
| `/audit` | Portal | KEPT |  |
| `/compliance` | Portal | KEPT |  |
| `/dashboard` | Portal | KEPT |  |
| `/downloads` | Portal | KEPT |  |
| `/evidence` | Portal | KEPT |  |
| `/help/how-it-works` | Portal | KEPT |  |
| `/inbox` | Portal | KEPT |  |
| `/more` | Portal | KEPT |  |
| `/my-work` | Portal | REDIRECT | /inbox (To do) |
| `/notifications` | Portal | REDIRECT | /inbox?tab=updates |
| `/onboarding` | Get started | KEPT |  |
| `/onboarding/profile` | Get started | KEPT |  |
| `/onboarding/reporting-defaults` | Get started | KEPT |  |
| `/onboarding/storage` | Get started | KEPT |  |
| `/onboarding/team` | Get started | KEPT |  |
| `/portfolio` | Portal | KEPT |  |
| `/portfolio/indicators` | Portal | KEPT |  |
| `/programmes` | Portal | KEPT |  |
| `/projects` | Portal | KEPT |  |
| `/projects/[id]` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/activities` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/activities/[activityId]` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/activities/import` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/activities/new` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/activities/@panel/(.)plan/[itemId]` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/activities/plan/import` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/activities/plan/[itemId]` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/activities/plan/new` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/activities/plan/start` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/adaptations` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/ask` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/beneficiaries` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/compliance` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/data` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/datasets` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/enter` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/evidence` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/evidence/[evidenceId]` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/evidence/import` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/evidence/new` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/finance` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/forms` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/forms/[formId]` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/forms/[formId]/edit` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/forms/new` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/import` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/indicators/[indicatorId]` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/logframe` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/logframe/history` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/logframe/import` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/logframe/indicators/import` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/logframe/new` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/logframe/new-indicator` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/management-report` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/places` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/report-builder` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/reports` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/reports/closing` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/reports/new` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/reports/[periodId]` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/reports/[periodId]/export` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/reports/[periodId]/indicators` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/reports/[periodId]/inputs` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/settings` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/setup` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/setup/profile` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/team` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/templates` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/templates/new` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/templates/[templateId]` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/[id]/templates/[templateId]/mapping` | Project tabs (`PROJECT_TABS`) | KEPT |  |
| `/projects/new` | Portal | REDIRECT | /projects/new/wizard |
| `/projects/new/classic` | Portal | REDIRECT | /projects/new/wizard (retired form) |
| `/projects/new/document` | Portal | KEPT |  |
| `/projects/new/document/[id]` | Portal | KEPT |  |
| `/projects/new/wizard` | Portal | KEPT |  |
| `/reports` | Portal | KEPT |  |
| `/settings` | Settings side list | KEPT |  |
| `/settings/ai` | Settings side list | KEPT |  |
| `/settings/ai-style` | Settings side list | KEPT |  |
| `/settings/ai-usage` | Settings side list | KEPT |  |
| `/settings/audit` | Settings side list | KEPT |  |
| `/settings/billing` | Settings side list | KEPT |  |
| `/settings/finance` | Settings side list | KEPT |  |
| `/settings/integrations` | Settings side list | KEPT |  |
| `/settings/places` | Settings side list | KEPT |  |
| `/settings/requirement-packs` | Settings side list | KEPT |  |
| `/settings/sector-library` | Settings side list | KEPT |  |
| `/settings/security` | Settings side list | KEPT |  |
| `/settings/setup` | Settings side list | KEPT |  |
| `/settings/setup-packs` | Settings side list | KEPT |  |
| `/team` | Portal | KEPT |  |
| `/visuals` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/alerts` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/assets` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/charts` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/charts/[projectId]` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/datasets` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/datasets/[datasetId]` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/datasets/new` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/[id]` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/maps` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/maps/[projectId]` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/new` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/templates` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/templates/sector/[id]` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/visuals/tv` | Visuals (Designs/Templates/Datasets + Tools) | KEPT |  |
| `/waiting` | Portal | KEPT |  |
| `/pricing` | Marketing site | KEPT |  |
| `/privacy` | Marketing site | KEPT |  |
| `/refunds` | Marketing site | KEPT |  |
| `/reset-password/[token]` | Auth (AuthFrame) | KEPT |  |
| `/security` | Marketing site | KEPT |  |
| `/shared/canvas/[token]` | Public link / field | KEPT |  |
| `/shared/dashboard/[token]` | Public link / field | KEPT |  |
| `/shared/infographic/[token]` | Public link / field | KEPT |  |
| `/signup` | Auth (AuthFrame) | KEPT |  |
| `/solutions` | Marketing site | KEPT |  |
| `/solutions/[sector]` | Marketing site | KEPT |  |
| `/subprocessors` | Marketing site | KEPT |  |
| `/support` | Marketing site | KEPT |  |
| `/support/account-billing` | Marketing site | KEPT |  |
| `/support/account-billing/[article]` | Marketing site | KEPT |  |
| `/support/advanced-features` | Marketing site | KEPT |  |
| `/support/advanced-features/[article]` | Marketing site | KEPT |  |
| `/support/[article]` | Marketing site | KEPT |  |
| `/support/getting-started` | Marketing site | KEPT |  |
| `/support/getting-started/[article]` | Marketing site | KEPT |  |
| `/support/how-to` | Marketing site | KEPT |  |
| `/support/how-to/[article]` | Marketing site | KEPT |  |
| `/support/report-writing-skills` | Marketing site | KEPT |  |
| `/support/report-writing-skills/[article]` | Marketing site | KEPT |  |
| `/support/security-privacy` | Marketing site | KEPT |  |
| `/support/security-privacy/[article]` | Marketing site | KEPT |  |
| `/support/troubleshooting` | Marketing site | KEPT |  |
| `/support/troubleshooting/[article]` | Marketing site | KEPT |  |
| `/terms` | Marketing site | KEPT |  |
| `/thanks` | Marketing site | KEPT |  |
| `/tour` | Marketing site | KEPT |  |
| `/` | Marketing site | KEPT |  |
