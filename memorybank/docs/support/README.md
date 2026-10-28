# Support articles: where they live

- **Source (this folder):** `docs/support/how-to/` holds the 2026-10-21 how-to articles for the gap-closure features. Edit them here first.
- **Served copy:** `apps/web/content/support/` is what the Support Center reads. Copy a changed article there (`cp docs/support/how-to/<file> apps/web/content/support/how-to/`), then deploy the web app.
- **Registration:** an article appears in the Support Center only when it is listed in `apps/web/src/app/support/how-to/[article]/page.tsx` (`FILE_MAP`) and `apps/web/src/components/support/wikiCategories.tsx`. Adding a file alone does not publish it.
- **Unpublished drafts:** `_unpublished-phase28/` holds Phase 28 copy that waits for the browser checks listed in `../marketing/phase28-publish-pack.md`. `_unpublished-phase30/` holds the site maps copy (plan Map view, "Where we work", pinning a place, custom boundaries) — built 2026-10-24, waiting for the live check; its README carries the publish checklist.

**2026-10-28:** all held drafts (work plan, site maps, Infographic Studio, Phase 33, batch 3) were published at the owner's request and registered in `FILE_MAP` and `wikiCategories.tsx`. The `_unpublished-*` folders are gone. The how-to sources are in `how-to/`; four reference articles sit beside this file.

**Still unverified in a browser or on a device** (the articles say so where it matters): Ask DonorDesk against the real model, KoboToolbox / SurveyCTO against real servers, the offline field app on a phone, dashboard dragging, and the French / Spanish / Arabic translations (first drafts, no native review). Re-check these before making stronger public claims.
