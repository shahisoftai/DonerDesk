# Support articles: where they live

- **Source (this folder):** `docs/support/how-to/` holds the 2026-10-21 how-to articles for the gap-closure features. Edit them here first.
- **Served copy:** `apps/web/content/support/` is what the Support Center reads. Copy a changed article there (`cp docs/support/how-to/<file> apps/web/content/support/how-to/`), then deploy the web app.
- **Registration:** an article appears in the Support Center only when it is listed in `apps/web/src/app/support/how-to/[article]/page.tsx` (`FILE_MAP`) and `apps/web/src/components/support/wikiCategories.tsx`. Adding a file alone does not publish it.
- **Unpublished drafts:** `_unpublished-phase28/` holds Phase 28 copy that waits for the browser checks listed in `../marketing/phase28-publish-pack.md`.

Registered on 2026-10-21 (how-to): turn on two-step sign-in, set a target schedule, check your portfolio, match donor indicators, review evidence, use comment threads, get a management report, record a change of plan, read a scanned document.
