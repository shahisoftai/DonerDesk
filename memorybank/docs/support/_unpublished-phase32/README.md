# Support articles for the Infographic Studio — NOT PUBLISHED

These articles describe the Infographic Studio (Phase 31 + Phase 32, deployed 2026-10-25): making a design, the Design check, approval and publishing, public share links, and wording suggestions. Nothing here is public yet. The feature was deployed but **not yet checked in a browser with a signed-in account** on the live site, so the articles must not go live first.

## Publish checklist

1. Check the screens in a browser on donordesk.online with a real login (the account the user chooses; never store its password): project → Infographics → New infographic (template, sections, preview); the Check tab; the Publish panel (publish a PNG and a PDF, approve, make a public link and open it in a private window); the suggestions panel ("Suggested from your records", and "Draft wording with AI" if AI is on for the organisation); the "Draft rows from my plan" button on a "Who does what, where" block.
2. Correct any article whose button name or step differs from what the screen shows. The labels used here were taken from the source code on 2026-10-25.
3. Move each file below into `memorybank/docs/support/how-to/`.
4. Register each article in **both** places: `FILE_MAP` in `apps/web/src/app/support/how-to/[article]/page.tsx` and the list in `apps/web/src/components/support/wikiCategories.tsx`. Category: How-To › Reporting.
5. Copy each into `apps/web/content/support/how-to/` (the served copy), then deploy the web app.
6. Remove this folder and record the publication in `memorybank/INDEX.md`.

## Articles

| File | Goes with |
|---|---|
| `how-to-make-an-infographic.md` | New infographic, templates, sections, formats, themes, the preview |
| `how-to-check-an-infographic.md` | The Check tab, Design check findings, waivers |
| `how-to-approve-and-publish-an-infographic.md` | Review, approval, the Publish panel, the published files |
| `how-to-share-an-infographic.md` | Public links, how long they last, revoking them, embedding |
| `how-to-get-wording-suggestions.md` | Suggestions from your records, AI draft, the who-does-what-where draft from the plan |
