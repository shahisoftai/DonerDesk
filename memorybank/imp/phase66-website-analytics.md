# Phase 66 — website analytics (Google Analytics 4 + Search Console) in Superadmin

DonorDesk Version 4.01. Branch `0026-simpler-project`. Status: built in one pass (batches 66.0–66.7).

## Goal
Show the platform owner how many people visit `donordesk.online`, where they come from and what they search for, inside the
Superadmin console, without tracking anyone inside the signed-in product.

## Decisions (owner, 2026-11-27)
1. **Opt-in banner for everyone**: nothing is sent to Google until the visitor presses Accept; Decline has equal weight.
2. **Metrics**: visitors, page views, top pages, sources, countries, devices, search queries and the sign-up path.
3. **Sign-up and trial-start events are sent** (consent first, no personal data).

## What is collected, and where
- Collection: GA4 (`NEXT_PUBLIC_GA_MEASUREMENT_ID`) on **public marketing and legal pages only** (`ANALYTICS_ROUTES`, an allow-list: any
  route not listed is never tracked, so a new route is private by default). Never in the portal, share, embed, collect, invite,
  reset-password, field or checkout routes. Page views are Google's automatic ones (no manual page view: an experiment showed Google sends one regardless of `send_page_view:false`); leaving the list pauses collection, so private pages are never counted, also by in-app navigation. Query strings of allow-listed pages reach Google as standard (campaign tags are wanted); none of those pages takes a sensitive query.
- Reading: a Google **service account** (read-only) is used by the API. Key file on the host, never in the repo, never returned.
- Display: Superadmin tab "Website visitors" (`GET /superadmin/website-stats?days=7|28|90`), one-hour cache.

## Architecture (SOLID)
| Layer | Unit | Single job |
|---|---|---|
| domain `contexts/site-analytics` | `stats-range`, `stats-report`, `traffic`, `search` | pure rules: ranges, report shape, shares, CTR, deltas |
| application | `ITrafficSource`, `ISearchSource`, `IStatsCache` (ports) | what the use case needs, no Google in it |
| application | `GetWebsiteStatsHandler` | combines two sources, each part answers `OK / NOT_CONFIGURED / UNAVAILABLE`; one failing part never breaks the page |
| infrastructure | `ServiceAccountCredentials`, `GoogleTokenProvider` | parse/validate the key; sign a JWT, cache the token |
| infrastructure | `GoogleAnalyticsTrafficSource`, `SearchConsoleSource` | adapters: Google JSON <-> domain rows |
| infrastructure | `TtlCache`, `createSiteAnalytics(env)` | cache; the one composition point (reads env) |
| api | `registerWebsiteStatsRoutes` | thin route inside the Superadmin secured scope |
| superadmin app | `WebsiteStats.tsx` | draws the report |
| web `features/analytics` | `consent` (domain), `analytics-routes` (domain), `AnalyticsPort` (port), `GoogleTagAdapter` (only file that touches `gtag`), `ConsentManager` (presentation) | consent rules / where tracking may run / the port / the adapter / the screen |

Open for extension, closed for change: a new range is a row in `STATS_RANGES`; a new tracked route is a row in `ANALYTICS_ROUTES`;
a new event is a row in `ANALYTICS_EVENTS`; a second analytics vendor is a new adapter of `AnalyticsPort`.

## Honesty rules
- A figure Google does not return is `null` ("not available"), never 0. A day with no visits in GA's daily series is a real zero.
- Click-through rate is `null` with no impressions. Change against the previous period is `null` without a previous figure.
- The page says GA undercounts (declined consent, ad blockers) and that Search Console runs 2–3 days behind.
- Decline or withdraw = tracking disabled for the session, `_ga*` cookies removed.

## Sign-up path
`signupAction` redirects to `/welcome?kind=signup|trial&next=…` (validated; only `/onboarding` or `/checkout?plan=…`). `/welcome` is a tiny
public page: it fires `sign_up` (or `begin_trial`) if consent was given, then forwards at once. It works without JavaScript (meta refresh).

## Legal text
Cookie policy, privacy policy, sub-processors (new "Website visitors" section: Google, DPF/SCCs) and the banner text. Consent now lasts
180 days (was 15, which re-asked decliners too often); the cookie name and values are unchanged.

## Your part (done 2026-11-27) / deploy part
GA4 property `566025500`, stream `G-2EPCDV5H1J`, service account `donordesk-stats-reader@donordesk-505504.iam.gserviceaccount.com`
(Viewer in GA, Restricted in Search Console `sc-domain:donordesk.online`). Verified from this machine on 2026-11-27.
Host: key at `/opt/donordesk/shared/google-stats-sa.json` (chmod 600, owner `donordesk`); `api.env` gets
`GOOGLE_STATS_SERVICE_ACCOUNT_FILE`, `GA4_PROPERTY_ID`, `SEARCH_CONSOLE_SITE`. Web build gets `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
Superadmin is **not** shipped by `deploy-fast.sh`: it is built and uploaded by hand (see the deploy notes in the commit).

## Batches
66.0 plan · 66.1 domain · 66.2 application · 66.3 infrastructure · 66.4 API · 66.5 Superadmin UI · 66.6 public site (consent, loader, relay, legal) · 66.7 verify, commit, deploy, push.

## Not built
Measurement Protocol (server-side events), GA real-time view, per-tenant analytics, a first-party counter.
