# Support articles: where they live

- **Source (this folder):** `docs/support/how-to/` holds the 2026-10-21 how-to articles for the gap-closure features. Edit them here first.
- **Served copy:** `apps/web/content/support/` is what the Support Center reads. Copy a changed article there (`cp docs/support/how-to/<file> apps/web/content/support/how-to/`), then deploy the web app.
- **Registration:** an article appears in the Support Center only when it is listed in `apps/web/src/app/support/how-to/[article]/page.tsx` (`FILE_MAP`) and `apps/web/src/components/support/wikiCategories.tsx`. Adding a file alone does not publish it.
- **Unpublished drafts:** `_unpublished-phase28/` holds Phase 28 copy that waits for the browser checks listed in `../marketing/phase28-publish-pack.md`. `_unpublished-phase30/` holds the site maps copy (plan Map view, "Where we work", pinning a place, custom boundaries) — built 2026-10-24, waiting for the live check; its README carries the publish checklist.

`_unpublished-phase32/` holds the Infographic Studio copy (make a design, the Design check, approve and publish, share with a link, wording suggestions) — built and deployed 2026-10-25, not yet checked signed-in in a browser; its README carries the publish checklist.

Registered on 2026-10-21 (how-to): turn on two-step sign-in, set a target schedule, check your portfolio, match donor indicators, review evidence, use comment threads, get a management report, record a change of plan, read a scanned document.

## Drafts waiting to be published (as of 2026-10-22)

Each draft stays out of the Support Center until its screens are checked in a browser on the live site with a real account. Do not publish a claim that a draft lists under "not yet".

| Where | What | Waiting for |
|---|---|---|
| `_unpublished-phase28/` (this folder) | Work plan, My week, requests and reminders, risks, comments, custom fields and automatic reminders | Browser checks in `../marketing/phase28-publish-pack.md` §1, plus the checks listed at the end of each draft |
| `apps/web/content/support/_unpublished-batch3/` (tracked in git, edited in place) | Programmes and grants, framework history, outside partners, organisation export, donor requirements, report locks, sign-in passwords and lockout, AI usage and cost, files that could not be read | The browser check in that folder's `README.md`. Its articles are the source; this folder does not copy them |

Two-step sign-in is built and its article is registered. The security article and the sign-in drafts were corrected on 2026-10-22: they no longer say that two-factor sign-in is unavailable. Outside partners still cannot use it.
