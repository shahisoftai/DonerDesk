# Support articles: where they live

**DonorDesk Version 4.01** · updated 2026-11-15

- **Source of truth (served):** `apps/web/content/support/` is what the Support Center reads **and** where articles are edited. Its `INDEX.md` lists every article by category and says what to check when editing.
- **Mirror (this folder):** `docs/support/how-to/` and the four `reference-*.md` beside this file are **copies** of the articles written for the gap-closure and later batches, kept here so the memory bank holds the text. They were re-synced from the served files on 2026-11-15 after the Version 4.000 review; if you change a served article, copy it back (`cp apps/web/content/support/how-to/<file> docs/support/how-to/`). Do not edit this mirror first.
- **Registration:** an article appears in the Support Center only when it is listed in the section's `[article]/page.tsx` (`FILE_MAP`), in `apps/web/src/features/help/domain/help-index.ts` (the in-app help search) **and** in `apps/web/src/components/support/wikiCategories.tsx`. Adding a file alone does not publish it. A new article = a file, three registrations, and a line in `INDEX.md`.
- **Navigation words:** [`ux-4000-map.md`](ux-4000-map.md) is the Version 4.000 map (left menu, project tabs, Settings list, Visuals, palette and shortcuts, and what moved). Every article uses these names: "Inbox" not My Work, **Plan → Results framework** not the Logframe tab, **Settings → Team** not the Team tab, **Data → More → Data tables** not Report builder.
- **Unpublished drafts:** none are held. The `_unpublished-*` folders (phase 34, 36, 38, 41, 44) hold drafts that were written for later batches; they predate the 4.000 layout, so check their paths against `ux-4000-map.md` before publishing one.

**2026-10-28:** all held drafts (work plan, site maps, Infographic Studio, Phase 33, batch 3) were published at the owner's request and registered.
**2026-11-15:** the whole support set was reviewed for the Version 4.000 layout (about 85 articles changed, four added: find your way around, datasets, choose where you work, record figures by place). A link checker (every `/support/...` link must be a registered article, every `FILE_MAP` file must exist) was run and passed; it is a script in the conversation, not a committed test.

**Still unverified in a browser or on a device** (the articles say so where it matters): Ask DonorDesk against the real model, KoboToolbox / SurveyCTO against real servers, the offline field app on a phone, dashboard dragging, the French / Spanish / Arabic translations (first drafts, no native review), the evidence selection bar, **Attach the files**, stacked panels and form-draft restore. Re-check these before making stronger public claims.
