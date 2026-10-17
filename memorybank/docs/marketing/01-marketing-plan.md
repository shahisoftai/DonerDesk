# DonorDesk Marketing Plan, October 2026 to March 2027

**Owner:** founder (decision rights), with a marketing lead and a product lead as named in the workstreams.
**Status:** Plan of record. Review monthly; re-baseline at the end of each quarter.
**Companion documents:** `02-feature-inventory.md` (what is true), `03-positioning-and-messaging.md` (what we say),
`04-website-redesign-brief.md` (the site), `05-overhaul-changelog.md` (what changed in this overhaul).

---

## 1. Situation

**What we sell.** A web platform where a grant-funded programme is managed (logframe, indicators, activities,
evidence, compliance, team) and its donor reports are produced from that record, checked and approved by people.
The inventory shows the breadth; most of it is live.

**What the market sees today.** The public site presented DonorDesk as a reporting tool: the hero, the six
features, and the FAQ were built around drafting and export. The management layer (activity capture, Data
Center, My Work, evidence linking) was described in one line. A buyer who needs a tracker reads it as a report
writer and assumes they would still need a separate system to run the programme.

**What we lack for credibility.** No approved customer logos, testimonials or case studies appear on the site.
Before any launch spend, confirm whether any paying customers can be named, and if so get written approval for
the exact wording (see section 9).

**Where the advantage is.** A single record from activity to donor report, with traceable numbers and a human
approval step. Competitors that sell either data collection or drafting alone do not hold the whole chain. This
is the claim to prove, not assert.

## 2. Goals (six months)

| # | Goal | Measure | Target by 31 March 2027 |
|---|---|---|---|
| G1 | Qualified sign-ups from the target segments | Free workspaces created by segment | 150 (assumption; to be re-baselined after month 1) |
| G2 | Activation: a real project in use | Workspaces with 1 project and at least 5 activity records within 14 days | 35% of sign-ups |
| G3 | Reports produced | Reports approved, not drafts | 25 approved reports from activated workspaces |
| G4 | Paid conversion | Workspaces on Team or Growth | 15 paid accounts |
| G5 | Proof | Named, approved references or case studies | 3 approved references (written consent) |
| G6 | Message clarity | Share of prospects who describe DonorDesk as a management system in their own words (interviews) | 6 of 10 |

These targets are planning assumptions, not forecasts. They are set so the team can see whether the
management-first message is working, which is the point of this period.

## 3. Target segments

Priority order reflects where the product is strongest today (humanitarian and development evidence, donor
templates, Data Center) and where the buying decision is made.

| Priority | Segment | Typical profile | Why they fit | Entry point |
|---|---|---|---|---|
| **1** | Local and national NGOs with 2 to 15 active grants | 20 to 300 staff; one M&E or grants team; 1 to 3 donors | Reporting is a team-wide pain and the Team plan fits | Free workspace; the Academy demo |
| **2** | INGO country offices and UN implementing partners | Several donor templates; a country-level M&E lead | Template handling and approval rules matter most | Demo with an M&E lead; Enterprise conversation |
| **3** | Research and public health programmes | Academic or ministry-linked projects with evidence standards | The evidence and audit story matters | Content and webinars |
| **4** | Government-funded programme units and consultancies | Units that report to a funder; consultancies that report for clients | Multi-project and reviewer roles | Partner referrals |

**Not targeting now:** donors themselves (they do not buy the tool), and organisations with no grant reporting
obligation.

## 4. Offer

### 4.1 Plans (from `plan.ts`; do not change the figures here without changing the code)

| Plan | Monthly | Annual | For |
|---|---|---|---|
| Starter | Free | Free | One programme, trying the system |
| Team | $79 (NGO first-year $59.25) | $790 (NGO first year $592.50) | Several grants, one team |
| Growth | $149 (NGO first-year $111.75) | $1,490 | Several donors, high reporting volume, own AI provider |
| Enterprise | Contract (from $12,000 a year) | Contract | Multi-country, SSO/SCIM, residency, SLA |

### 4.2 Offer rules

- Free workspace with no card. The Academy demo is always available.
- 14-day trial on paid plans, only when the trial flag is on (currently off on the live site; decide before launch, see section 10).
- Verified nonprofit discount: 25% in year one on Team and Growth. Verification is a manual review of the NGO registration.
- Annual billing: two months free.
- Enterprise: pilot first, then a contract with nonprofit pricing built in.

### 4.3 What we do not offer

No lifetime deals, no per-report pricing, no certifications we do not hold, and no "guaranteed compliance."

## 5. Positioning and messages

Full copy is in `03-positioning-and-messaging.md`. In short:

- **Category:** programme management that produces donor-ready reports.
- **Hero line:** Run your programme. Report from the record.
- **Four pillars, in order:** run the programme, keep the evidence, stay compliant, report from the record.

## 6. Channels and activities

### 6.1 Owned

| Channel | Activity | Owner | Cadence |
|---|---|---|---|
| Website (home, Features, Pricing, Support) | Rebuild per `04-website-redesign-brief.md`; A/B test the hero line after launch | Marketing lead | Launch, then monthly review |
| Support Center | Keep articles current with each release; add the management articles (Data Center, activity capture, My Work) | Product lead with support | Each release |
| Product tour | Keep the narrated tour in step with the UI; tour is the main self-serve demo | Product lead | Each release |
| LinkedIn company page | Two posts a week: one product-in-use post (screenshot or short clip of a real workflow, with sample data labelled), one practice post (how reporting works) | Marketing lead | Twice weekly |
| Email (signed-up users) | Onboarding sequence: day 0 create a project; day 2 log your first activity; day 5 set up the logframe; day 10 build your first report section; day 14 review what is still open | Marketing lead | Automated |

### 6.2 Earned and community

- **Practitioner communities.** Share practical notes in M&E and humanitarian reporting communities (for example
  professional networks and forums where grants officers ask about reporting). Answer questions; do not post
  links as spam.
- **Guest articles** on report writing and indicator design, for M&E and grants newsletters.
- **Webinars.** One per month: "From activity to donor report: a worked example" (uses the Academy demo, labelled
  as sample). Record and publish.

### 6.3 Partners

- M&E training providers and capacity-building organisations: an offer for their trainees (Starter extended
  for the training period, to be agreed).
- Verified-nonprofit networks and country NGO platforms: co-hosted webinars and a listing.
- Donor-compliance consultants: referral arrangement for an onboarding package (scope to be defined).

### 6.4 Paid (hold until G5 is met)

No paid acquisition until at least three approved references exist. Paid tests, when they start, are small
(a fixed monthly test budget with a stop rule: pause any channel with no qualified sign-up after four weeks).

### 6.5 Sales motion

| Stage | Who | Action | Exit criterion |
|---|---|---|---|
| Sign-up | Prospect | Creates free workspace | Project created |
| Activation | Product email | Onboarding sequence | 5 activity records and a logframe |
| Qualified | Marketing or founder | Reply-based or call-based check on the reporting calendar | A real donor report due within 90 days |
| Demo | Founder | 30 minutes, the prospect's own project data | Agreed pilot or trial |
| Pilot | Customer success | One reporting period, with an approved report as the outcome | Report approved; reference offered |
| Close | Founder | Plan selection; verification for NGO discount | Paid plan |

Enterprise: a guided pilot (one project, one donor template, one approved report) before the contract.

## 7. Content plan (first 90 days)

| Week | Asset | Purpose | Format |
|---|---|---|---|
| 1 | Website relaunch (home, Features, pricing) | Message clarity | Site |
| 1 | Deck v2.003 (management-first) | Sales and partners | PPTX |
| 2 | "Run your programme. Report from the record." explainer | Core message | 3-minute video with narration; the tour's voice can be reused |
| 2 | Support article set update | SEO and self-serve | Support Center |
| 3 | "What an activity record needs for a donor report" | Field-staff audience | Blog post |
| 4 | Webinar 1: From activity to donor report | Segment 1 | Live, then recorded |
| 5 | "Indicator design that survives reporting" | M&E audience | Guide (PDF) |
| 6 | Webinar 2: Donor templates in practice | Segment 2 | Live |
| 8 | Reference interview (first customer, with consent) | G5 | Written and video, after approval |
| 10 | "How DonorDesk checks a number" | Trust | Explainer with the verification steps |
| 12 | Quarter review published (anonymised, aggregate only if consented) | Proof | Blog |

Every asset uses sample data where real data is not approved, and says so.

## 8. Workstreams and owners

| Workstream | Lead | Support | Output |
|---|---|---|---|
| Website | Marketing lead | Frontend engineer | Relaunch, metrics |
| Support Center | Product lead | Support | Articles aligned to the inventory |
| Product content (tour, demo) | Product lead | Marketing | Tour and Academy kept current |
| Content and social | Marketing lead | Founder (voice) | Calendar, posts |
| Sales and pilots | Founder | Customer success | Demo, pilot, close |
| Partnerships | Founder | Marketing | Partner offers |
| Measurement | Marketing lead | Product analytics | Dashboard (section 9) |

Roles are assignments, not hires. Where one person holds two, the plan is still run as written; capacity is a
risk (section 11).

## 9. Measurement

**Funnel metrics (weekly):** visitors to sign-up; sign-up to project created; project to 5 activities; activities
to first report section; first approved report; paid conversion.

**Message metrics (monthly):** the interview check (goal G6), scroll and click on the Features page, the share of
demo requests that mention management or tracking (not only reporting) as the reason.

**Health metrics (monthly):** support tickets per active workspace, and the share of support articles reviewed in
the last 90 days.

Set up the funnel events before launch so week 1 has a baseline. Where analytics are not configured, the metric
is recorded as "not measured", not estimated.

## 10. Decisions needed before launch

1. **Trial.** The pricing page describes a 14-day trial, but the live site does not show it (the flag is off). Decide whether to turn it on for launch.
2. **Customer references.** Confirm whether any customer can be named. Without this, G5 is at zero and no proof is shown.
3. **Verification process.** Who reviews NGO registrations, and within what time (the pricing page says two business days).
4. **Enterprise contact.** The contact-sales route must have an owner and a response time.
5. **Video.** Whether the explainer uses the existing tour voice or a new recording.

## 11. Risks

| Risk | Likelihood | Impact | Response |
|---|---|---|---|
| Message reads as "reporting only" again | Medium | High | Management-first hero and features; G6 interviews each month |
| No proof points at launch | High | High | Lead with the verifiable product (inventory); pursue references in weeks 1 to 8 |
| Overclaiming AI or offline | Medium | High | Claims policy (`03`, section 9); support articles state the limits |
| Demand arrives faster than support capacity | Medium | Medium | Onboarding email sequence; support articles; capped trial pool if needed |
| Competing tools move into drafting | High | Medium | Compete on the connected record, not on drafting alone |
| Data-sensitivity concerns slow sales | Medium | High | DPA, subprocessors, audit log and the security page are published; prepare an answers pack for procurement |
| Single-person capacity | High | Medium | Sequence the workstreams (section 12); cut the paid channels first |

## 12. Calendar

| Period | Focus |
|---|---|
| Weeks 1 to 2 | Relaunch the website; publish the deck; confirm decisions in section 10; set up measurement |
| Weeks 3 to 6 | Webinar 1 and 2; onboarding emails live; first reference interview |
| Weeks 7 to 10 | Partner offers; first case study drafted for approval; NGO verification running |
| Weeks 11 to 13 | Quarter review; re-baseline targets; decide on paid tests |
| Months 4 to 6 | Scale what worked in G1 to G4; Enterprise pilots; second case study |

## 13. Budget

No cost figures are set in this plan. Budget lines to be filled once the founder approves a monthly envelope:

- Website hosting and tooling (existing)
- Video production (one explainer)
- Webinar platform
- Small paid test (held until G5 is met)
- Partner and event costs
- Contractor time for copy review and design, if needed

## 14. Review

Review monthly against section 2 and section 9. Change a target only with a recorded reason. Update
`02-feature-inventory.md` on every release that changes what the product does, and this plan when a decision in
section 10 closes.
