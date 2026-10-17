# Marketing Overhaul: Changelog (October 2026)

**Trigger:** the public site presented DonorDesk as a reporting tool. The product is a programme management
system whose main output is donor reporting. This overhaul moves the positioning, the site, the support
library and the deck to match the product, using only claims verified against the code.

## Added

| File | What it is |
|---|---|
| `memorybank/docs/marketing/README.md` | Index and rules for the marketing folder |
| `memorybank/docs/marketing/01-marketing-plan.md` | Plan: goals, segments, offer, channels, 90-day calendar, measures, open decisions |
| `memorybank/docs/marketing/02-feature-inventory.md` | Verified feature map with `LIVE` / `LIVE-LIMIT` / `CONTRACT` / `NOT BUILT` status |
| `memorybank/docs/marketing/03-positioning-and-messaging.md` | Category, taglines, pillars, objections, language, claims policy |
| `memorybank/docs/marketing/04-website-redesign-brief.md` | Site architecture and section copy |
| `memorybank/docs/marketing/05-overhaul-changelog.md` | This file |
| `memorybank/docs/presentations/DonorDesk-Overview-v2.003-Management-First.pptx` | New 14-slide deck (management first, with limits and plans) |
| `scripts/build-donordesk-management-deck.py` | Generator for the v2.003 deck |
| `apps/web/src/components/landing/platform-content.ts` | Shared module copy for the home page and `/features` |
| `apps/web/src/components/landing/MarketingNav.tsx` | Shared header for marketing pages |
| `apps/web/src/components/landing/MarketingFooter.tsx` | Shared footer (adds a Platform column and the legal pages) |
| `apps/web/src/app/features/page.tsx` | New `/features` page: every module, what it does, who uses it, "good to know" limits |

## Changed

| File | Change |
|---|---|
| `apps/web/src/app/page.tsx` | Rewritten: management-first hero, "One record" plan-to-report stages, "Run the programme" and "Report from the record" modules, updated how-it-works, audiences, pricing (same figures), security, FAQ, closing CTA |
| `apps/web/src/components/landing/HomeFaq.tsx` | FAQ rewritten: adds "Is DonorDesk just a reporting tool?", offline limits, Google Drive ownership; removes the reporting-only framing |
| `apps/web/src/app/sitemap.ts` | Adds `/features` |
| `apps/web/src/app/layout.tsx` | Default title and site description now lead with programme management |
| `apps/web/src/app/pricing/page.tsx` | Metadata description only (body copy not yet rewritten, see open items) |
| `memorybank/docs/support/**` (120 articles) | Removed the internal stamp "DonorDesk Version 2.001" from every public article |
| `memorybank/docs/support/basic-information/what-is-donordesk.md` | Rewritten around the programme record, roles, what the user does, and what DonorDesk does not do |
| `memorybank/docs/support/reference-faq.md` | "What is DonorDesk?" rewritten; new "Is DonorDesk just a reporting tool?" entry |

## Corrected during the work (claims that were not verified)

- **Evidence checksums.** The old site said evidence has "checksums". The code fingerprints the text a draft cites (SHA-256) when the draft is built. Files are not checksummed at upload. The inventory and the new copy now say exactly that.
- **Offline.** Only finished activities are queued. The app cannot be opened offline (the service worker is not built). Copy says so.
- **Certifications.** None are held. The site and deck say so and do not claim any.

## Checked and left unchanged

- **Plan figures.** Every price and limit on the site, pricing page, support docs and FAQ matches `plan.ts`. No changes needed.
- **Support links.** All 113 support links in the Support Center index resolve to a route map and a file (checked before the edits; no routes were moved).
- **Support content.** Data Center, dictation, offline, charts and My Work already have articles. The file format list already includes Markdown.
- **Direct submission.** The FAQ says DonorDesk does not send reports to donors. Confirmed: the donor-portal service exists but is not wired to any route.
- **Existing deck.** `DonorDesk-for-NGOs-v2.002.pptx` is kept. The new deck is a separate file, so the earlier one stays available.

## Verification

- `npx tsc -p tsconfig.json --noEmit` in `apps/web`: passes (run after the last web edit).
- `node --experimental-strip-types --test tests/unit/*.test.mts` in `apps/web`: 280 tests, 280 pass.
- Deck: built from the script, rendered to PDF and images through LibreOffice, layout checked on all 14 slides.
- Production build (`next build` in `apps/web`): exit 0, no warnings or errors in the log. `/features` and the support pages are generated.

## Open items (not done, and why)

1. **Narrated tour.** `apps/web/src/features/tour/domain/public-tour-steps.ts` (step 2) says the field flow "works offline too". That is stronger than the product. The tour narration is recorded per step, so the text cannot change without re-recording the audio. Re-record the step, or change the sentence before the next recording.
2. **Pricing page body.** Only its metadata was changed. The feature lists and comparison still describe the product in reporting terms in places (for example "claim-level provenance" and "exports"). Rewrite with the management pillars next.
3. **Offline and dictation articles.** `how-to-work-offline-and-take-photos.md`, `how-to-dictate-instead-of-typing.md` and `security-privacy-data-handling.md` were not re-read line by line against the inventory. Check them against the `LIVE-LIMIT` lines.
4. **Decisions before launch** (marketing plan, section 10): trial visibility, customer references, NGO verification owner and turnaround, Enterprise contact owner, explainer video voice.
5. **Analytics.** Funnel events are not set up. Measurement is "not measured" until they are.
6. **Evidence wording.** No support article mentions checksums (checked). Keep it that way until a file-level checksum exists.
7. **Competitor positioning.** Not written. It needs verified competitor facts before it can be published.
8. **Uncommitted work in the tree.** Files this overhaul did not touch were already modified or deleted before it began (for example the report editor, `AGENTS.md`, and the removed `DonorDesk-for-NGOs.pptx`). They were left as they were.
