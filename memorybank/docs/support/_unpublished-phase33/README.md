# Support articles for Phase 33 — NOT PUBLISHED

**DonorDesk Version 3.007.** These articles describe the Phase 33 features deployed on 2026-10-27 and 2026-10-28: places, formulas and period submission, collection forms and the field app, dashboards, Ask DonorDesk, interface languages, integrations (API keys, webhooks, MCP, KoboToolbox and SurveyCTO), and the organisation-wide two-step sign-in requirement.

**Nothing here is public.** Several features have **not been checked by a person in a signed-in browser**, and two are not yet verified at all: Ask DonorDesk (never run against a real model) and the KoboToolbox / SurveyCTO connectors (never run against a real server). The public site must not describe them as available until those checks are done. `pending.md` lists the checks.

## Publish checklist

1. Check each feature on donordesk.online with a real login (the account the user chooses; never store its password). Work through the list in `memorybank/pending.md` ("Phase 33 — open items").
2. Correct any article whose button or menu name differs from the screen. The labels here were taken from the source code on 2026-10-28.
3. Move each article into `memorybank/docs/support/how-to/` (or `troubleshooting/` where marked).
4. Register each article in **both** places: `FILE_MAP` in `apps/web/src/app/support/how-to/[article]/page.tsx` and the list in `apps/web/src/components/support/wikiCategories.tsx`.
5. Copy each into `apps/web/content/support/`, then deploy the web app.
6. Remove this folder and record the publication in `memorybank/INDEX.md`.

## Articles

| File | Goes with | Audience | Status |
|---|---|---|---|
| `how-to-ask-a-question-about-a-project.md` | Ask DonorDesk | Anyone who can see the project | Held until the real-model check |
| `how-to-make-a-dashboard.md` | Dashboards, sharing | Anyone who can see the project | Held until the browser check |
| `how-to-collect-answers-with-a-form.md` | Collection forms, records, photos, links | Project team | Held until the browser check |
| `how-to-use-the-field-app-offline.md` | Field app | Field staff | Held until a phone test |
| `how-to-bring-in-kobotoolbox-or-surveycto-submissions.md` | Connectors | Project managers | Held until a real-server test |
| `how-to-connect-api-keys-webhooks-and-ai-assistants.md` | Keys, webhooks, MCP | Administrators | Held until the browser check |
| `how-to-require-two-step-sign-in.md` | Organisation requirement | Administrators | Held until the browser check |
| `how-to-change-the-interface-language.md` | Languages | Everyone | Held until a native-speaker review |
