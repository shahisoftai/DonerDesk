# Marketing: DonorDesk

Start here. Documents in reading order:

| # | Document | Use it for |
|---|---|---|
| 01 | [Marketing plan](01-marketing-plan.md) | Goals, segments, offer, channels, 90-day calendar, measures, decisions needed |
| 02 | [Feature inventory](02-feature-inventory.md) | What is true, with status (`LIVE`, `LIVE-LIMIT`, `CONTRACT`, `NOT BUILT`). Check every claim here first |
| 03 | [Positioning and messaging](03-positioning-and-messaging.md) | Category, taglines, pillars, objections, words to use and avoid, claims policy |
| 04 | [Website redesign brief](04-website-redesign-brief.md) | The site structure and section copy the code implements |
| 05 | [Overhaul changelog](05-overhaul-changelog.md) | Every file changed in the October 2026 overhaul, and what is still open |

Related:

- Presentation: `memorybank/docs/presentations/DonorDesk-Overview-v2.004.pptx`, built by `scripts/build-donordesk-management-deck.py` (`--out` the same path).
- Homepage concept and palette: `04-website-redesign-brief.md`, sections 3 and 3a. Source: `apps/web/src/components/landing/home/`.
- Support Center source: `memorybank/docs/support/` (rendered at `/support`).
- Plan figures: `packages/domain/src/contexts/billing/plan.ts` (the single source of commercial truth).

## Rules for anyone editing these documents

1. Every factual claim must be `LIVE` or `LIVE-LIMIT` in `02-feature-inventory.md`, with the limit stated where the claim appears.
2. Prices and limits come from `plan.ts`. Change the code first, then these documents and the site.
3. No customer names, logos, testimonials, certifications or uptime figures without written approval.
4. When a feature ships or changes, update `02-feature-inventory.md`, then the support article, then the site copy in `apps/web/src/components/landing/platform-content.ts`.
