# Support articles for batch 3 — NOT PUBLISHED

These articles describe features built on 2026-10-21 (audit batch 3): programmes and grants, framework history, outside partners, the organisation export, donor requirements, report locks, sign-in lockout, AI usage and cost, and files that could not be read. The features are deployed (2026-10-20), but no one has checked the new screens in a browser with a real account yet. The articles stay here, outside the folders the Support Center reads, until that check is done.

## Publish checklist

1. Check each screen named in an article in a browser on the live site with a real login (the partner invitation and its first screens need an outside test account).
2. Move each file into `memorybank/docs/support/how-to/` or `reference/` (use the same prefix the folder already uses).
3. Register each article in both `FILE_MAP` (`apps/web/src/app/support/how-to/[article]/page.tsx`) and `apps/web/src/components/support/wikiCategories.tsx`, and in the sitemap if it is not generated.
4. Remove this folder and move the note in `INDEX.md` into the normal lists.
5. Do not publish the claims listed as "not yet" in each article.

## Articles

| File | Category | Checks needed |
|---|---|---|
| `how-to-see-framework-history.md` | How-To › Projects | Framework history page, sign-off |
| `how-to-set-up-programmes-and-grants.md` | How-To › Projects | /programmes, placing a project |
| `how-to-invite-an-outside-partner.md` | How-To › Team | Team invite (outside partner), partner's first sign-in |
| `how-to-take-your-data-with-you.md` | How-To › Settings | both downloads, the ZIP contents |
| `how-to-meet-donor-requirements.md` | How-To › Reporting | requirement packs, "Result to explain" |
| `reference-report-locks-and-reopening.md` | Reference | locked notice on inputs, reopen |
| `reference-sign-in-passwords-and-lockout.md` | Reference | password rule messages, lockout message |
| `reference-ai-usage-and-cost.md` | Reference | AI usage page cost column |
| `how-to-fix-a-file-that-could-not-be-read.md` | How-To › Evidence | evidence "words not read" notice |

## Edits to existing articles (apply at publish)

- `troubleshooting-login-issues.md`: add the lockout paragraph from `reference-sign-in-passwords-and-lockout.md`.
- `security-best-practices.md`: state the 12-character rule and the lockout.
- `reference-error-codes.md`: add the messages in the table of each new article.
