# Website overhaul: recommendations for donordesk.online

**DonorDesk Version 3.007 · written 2026-10-28 · status: RECOMMENDATIONS, nothing built yet**
**Written for:** the owner, to decide what to build. It builds on `01-marketing-plan.md`, `03-positioning-and-messaging.md` and `04-website-redesign-brief.md` (the October 2026 site) and replaces their "what the site should do next". Every product claim below traces to `memorybank/Features/` and `AGENTS.md`; claims that need evidence we do not have yet are marked **[needs proof]**.

---

## 0. The short version

The product changed faster than the site. Since the October redesign we shipped places and maps, forms and an offline field app, dashboards, an API, and (Phase 34) a Chart Studio with 43 chart kinds, a spreadsheet entry sheet, six sector dashboard templates, a map screen and a report builder. The site still tells a *report-writing and tracking* story in generic words. A visitor from a health NGO, a WASH consortium or a school-feeding programme cannot see **their** work on it in the first ten seconds.

Eight moves, in order of effect on "I instantly see myself in this, and I want it":

1. **Let the visitor pick their world in the hero** (sector, organisation type, role) and show **their** dashboard, map and indicators, drawn live by our own chart engine from demo data. This is the single biggest lever and we are unusually able to do it (six sector templates, 43 chart kinds, demo projects already exist).
2. **One promise, in the visitor's words, not ours.** Keep the category ("programme management that produces donor-ready reports") but lead with outcomes ("know where you stand before the donor asks", "your whole programme in one place") in plain language; keep *logframe* and *indicator* in the body, not the headline.
3. **A "Solutions" layer**: pages by sector (WASH, health, nutrition, education, food security, protection, plus cash and livelihoods and emergency response), by organisation (local NGO, INGO country office, consortium lead, funder or intermediary), by role, and by moment ("a donor report is due in two weeks"). Each page is built from one template, so it costs content, not engineering.
4. **A try-it path with no sign-up wall**: "Open a demo [sector] programme" in one click, with a guided tour, then "Use this as my starting point".
5. **Real proof**: real screenshots from our demo programmes, three named references (consent needed), a short founder-led video, a security page that states what is true.
6. **A simpler pricing story** that starts from "what are you running?" rather than seats and AI credits, with the NGO welcome price and the free plan visible in the first screen.
7. **A modern, fast, low-bandwidth, accessible build** (our audience is often on slow connections and phones), with the marketing site in French, Spanish and Arabic once natively reviewed.
8. **Measure it** (the site has no analytics today): a privacy-friendly funnel from landing to demo to sign-up to first project, so every change after launch is tested, not guessed.

One decision that changes the brief, answered in section 1.3: **"donation-based projects" can mean two different things.** DonorDesk serves programmes that report to institutional donors and funders. It is not a fundraising or donor-CRM tool. The site must say so plainly, and we should decide whether to offer a bridge.

---

## 1. What I checked

### 1.1 The site today (from the code, `apps/web/src/app` and `components/landing`)

| Area | State |
|---|---|
| Home | Dark editorial theme (Newsreader serif, IBM Plex, saffron/teal). Hero rotates three statements every five seconds. Statement band, four-stage tabs (Plan / Deliver / Monitor / Demonstrate), a four-quarter loop, a reporting example, three **example** portfolio cards, seven roles, plans, trust, FAQ, final CTA. |
| Features | One long page: 6 groups, **26 feature blocks**, a 26-chip jump list. Honest limits are stated per feature (good). |
| Pricing | Starter $0, Team $79, Growth $149, Enterprise from $12k a year; NGO welcome price 25% off the first year; seats, active projects, storage and "AI report drafts a month" as the main axes. |
| Tour | `/tour` narrated product tour; 16 screenshots in `public/tour`. |
| Trust | `/security`, `/dpa`, `/subprocessors`, `/privacy`, `/terms`, `/refunds`, cookie banner. |
| Support | Seven article categories (getting started, how-to, advanced features, report writing skills, security and privacy, account and billing, troubleshooting). |
| Missing | Any analytics; case studies or named references; a customer logo row; sector or organisation pages; a try-without-signing-up demo; screenshots of the Phase 34 features; a video; the site in other languages; a comparison page; a resource or template library; an "about us". |

### 1.2 What the product now covers (the inventory the site must reflect)

Grouped by what a programme team is trying to get done, with the 2026-10-28 additions marked **NEW**:

| Job | What exists |
|---|---|
| **Plan** | Logframe and indicators (baselines, targets, schedules, formulas, groups, "not applicable"), work plan with timeline, calendar and map, milestones, risks and changes of plan, budget lines, programmes and grants, donor requirement packs, **NEW** bookmarks |
| **Collect** | Activity capture (typed or dictated), collection forms with rules and photo questions, public form links, **offline field app**, KoboToolbox and SurveyCTO import, Excel import everywhere, beneficiary register, **NEW Entry Sheet** (spreadsheet-style entry, paste from Excel, autosave, offline queue) |
| **Track** | Data Center, indicator pages with value history, entry windows and period submission, stoplights, results by place, formula indicators, **NEW indicator views** (against target, over time, by place, by group, table) |
| **See** | Dashboards, infographics, maps, **NEW Chart Studio** (43 kinds, full editing, saved charts with versions), **NEW sector dashboard templates** (WASH, health, nutrition, education, food security, protection; always editable), **NEW dashboard tabs, full screen for wall displays, print**, **NEW report builder** (ask in a sentence, break down by sex or age group, add to a dashboard), **NEW Maps screen** with KML and GeoJSON |
| **Prove** | Evidence library with confidentiality levels, verification, linked files, hash-chained audit log, second-approver rule, encryption options, row-level isolation, two-step sign-in (which an administrator can require) |
| **Report** | Donor templates (Word, PDF, Excel) extracted once, sourced AI drafting (a person approves), claim checks against the record, readiness checklists, roll-ups, exports, management report |
| **Share and connect** | Read-only dashboard and infographic links, embeds, public API, webhooks, **MCP server** for AI assistants, outside-partner access to named projects only, SCIM, four interface languages, Ask DonorDesk (grounded Q&A, off until enabled) |

### 1.3 What the product does not cover (so the site must not imply it)

"Has all the features any humanitarian or donation-based project may need" is a promise the site cannot keep and should not make. Honest framing: **complete for planning, monitoring, evidence and donor reporting; connected to the rest.**

| Need | Today | Recommendation |
|---|---|---|
| **Fundraising from individual donors** (campaigns, receipts, gift aid, donor CRM) | Not in the product | Say so on the site ("for programmes that report to funders"); list integrations or exports as roadmap only if built; decide in section 15 |
| Cash and voucher assistance, case management, supply chain, HR, accounting | Not in the product (finance is a light budget and spending layer; the full register is Phase 34.6) | A "works alongside" page naming categories, not products we have not integrated |
| Indicator library (Sphere, CHS, sector standards) | Not built | A strong **lead magnet and product feature**: a searchable indicator bank people can start a logframe from |
| IATI export, cost per result | Planned (33.11 / 34.6) | Do not claim until built |
| Real-time collaboration on a report | Not built | Do not claim |
| Certifications (ISO 27001, SOC 2) | None | State this plainly; it builds trust with procurement teams |

---

## 2. What is holding the current site back

I would test each of these, but from the code and the brief I expect:

1. **It speaks to the person who already knows the term.** "Logframe", "indicator", "programme cycle" and "the record" are our words. A programme director, a country manager or a founder of a small NGO does not search for them. The first screen should name a *situation* ("the donor report is due and the numbers are in six places") before it names a *feature*.
2. **The hero rotates.** Three statements every five seconds mean most visitors read one half-sentence and leave. One strong, stable promise converts better; the other two become section headings.
3. **Everything is generic.** The example portfolio is fictional ("Example projects for illustration") and the screens are a single sample project. Visitors cannot tell whether DonorDesk fits *a WASH recovery programme with three donors* or *a clinic network*.
4. **Features, not jobs.** 26 feature blocks and a 26-chip list is a catalogue. The visitor needs six jobs (plan, collect, track, see, prove, report) and then a way to go deeper.
5. **No proof.** No named organisations, no numbers from real use, no video, no founder face. For a product that holds a programme's evidence, trust is the purchase.
6. **Price is explained by our limits**, not their outcomes: "5 active projects, 5 seats, 25 GB, 20 AI drafts a month". A small NGO cannot tell which plan is theirs.
7. **The newest and most visual features are invisible.** The Chart Studio, the sheet, sector dashboards and maps are exactly what makes the product feel modern, and none of them is on the site.
8. **No way to try it without committing.** The tour is a narrated walkthrough, not the product.
9. **No measurement.** We cannot see where visitors leave.

---

## 3. How a visitor "instantly connects": the model

People recognise themselves through four handles. The site should let them choose any one:

| Handle | Examples | Where it appears |
|---|---|---|
| **Their work** (sector) | WASH, health, nutrition, education, food security, protection, cash and livelihoods, emergency response | Hero selector; `/solutions/wash` and the rest |
| **Their organisation** | Local or national NGO · INGO country office · consortium or UN implementing partner · funder or intermediary · research or public-health programme | `/solutions/ngo`, `/solutions/ingo`, `/solutions/consortia`, `/solutions/funders`, `/solutions/research` |
| **Their role** | Programme director · project manager · M&E officer · grants and compliance officer · field officer · finance officer | `/solutions/for-me-and`, role tiles on home (the seven roles we already have) |
| **Their moment** | "A donor report is due in two weeks" · "We have three donors with three formats" · "Our field team has no signal" · "An audit is coming" · "We are outgrowing spreadsheets" | Problem cards on home; each links to a short page |

The mechanism that makes it instant: **the hero asks one question** ("What do you run?") with sector chips, then redraws the page's showpiece — a real dashboard, a map and an indicator table in that sector's vocabulary — and rewrites the sub-head. We already have the pieces: `sector-templates.ts` (six sectors with role names such as "people trained"), the chart engine that draws from data, and demo projects (`CreateDemoProject`). It is a front-end task, not a new product.

---

## 4. Positioning and the promise

Keep the category from `03-positioning-and-messaging.md` — *programme management that produces donor-ready reports* — because it is true, it is ownable, and it separates us from "AI report writers" and from pure data-collection tools. Change **how we say it**.

**Recommended hero (stable, not rotating):**

> **Run every grant, and prove it, in one place.**
> Plan the work, collect data in the field (even offline), watch every indicator on dashboards and maps, keep the evidence beside it, and draft the donor report from the same record. Built for NGOs and the donors who fund them.
> **[Open a demo programme]** **[Create a free workspace]** *No card. Your data stays yours.*

Two alternates to A/B test (both already approved lines, promoted from the rotation):

- *Know where your programme stands before the donor asks.* (best for directors and M&E leads)
- *Stop rebuilding the programme every quarter.* (best for grants and reporting staff)

**Promise ladder** (use in this order everywhere; each rung is true today):

1. See your whole programme: plan, delivery, results, places, risks.
2. Collect it once, wherever the work happens, with or without a signal.
3. Trust it: every number traces to a source, every change is logged.
4. Show it: dashboards, maps and infographics your board and donors understand.
5. Report from it: donor-template drafts that cite their sources, checked, approved by a person.

**Words to avoid** (carried over): "AI writes your reports", "never miss a deadline", "#1", "track impact". **New to avoid:** "all-in-one for every NGO need", "fundraising", "real-time" (figures are as recorded), "certified" anything.

**Say in plain words, add the term in brackets once:** "your plan of results and targets (logframe)", "the numbers that show progress (indicators)".

---

## 5. Information architecture

```
Home
Product ▾            Platform (the 6 jobs)  ·  Tour & demo  ·  What's new  ·  Integrations & API  ·  Security
Solutions ▾          By sector  ·  By organisation  ·  By role  ·  By moment
Pricing              (plan chooser, NGO price, compare, FAQ)
Resources ▾          Support centre  ·  Guides  ·  Templates & indicator bank  ·  Webinars  ·  Glossary  ·  Changelog
Customers            Stories & references (when consent exists)
Compare              DonorDesk vs spreadsheets · vs data-collection tools · vs report-only tools   (no competitor claims we cannot prove)
Company              About · Contact · Book a walkthrough · Security & trust
[Log in]  [Open a demo]  [Start free]
```

- Keep the existing routes (`/features`, `/pricing`, `/tour`, `/security`, `/support`, legal pages). `/features` becomes **Platform** (shorter, six sections, each opening into detail).
- Add: `/solutions/*`, `/demo`, `/resources/*`, `/compare/*`, `/customers`, `/about`, `/changelog`.
- Mobile navigation first (many visitors arrive on a phone); a persistent "Open a demo" button in the header.
- Footer carries the trust and legal links plus a language switcher.

---

## 6. Homepage blueprint (top to bottom)

| # | Section | Purpose | Content |
|---|---|---|---|
| 1 | **Hero with the sector chooser** | Instant connection | Promise (section 4), two CTAs, then "What do you run?" chips: WASH · Health · Nutrition · Education · Food security · Protection · Cash & livelihoods · Emergency · Other. Choosing a chip redraws the product panel on the right: a live dashboard in that sector's vocabulary (our chart engine, demo data, labelled "example") and rewrites one line of the sub-head. Default (no choice): a mixed portfolio. |
| 2 | **Trust strip** | Reduce doubt at once | Named organisations when we have consent (until then: "Used in pilots by teams working in [countries]" only if true). Else a plain line: "Free plan. No card. Export your data any time." |
| 3 | **"Sound familiar?"** | Self-recognition by moment | Five cards, each a situation: *The report is due and the numbers are in six places* · *Three donors, three formats* · *The field team has no signal* · *Nobody can say which activities are late* · *An audit is coming and the evidence is in chat threads*. Each ends "How DonorDesk handles it →" to a short page. |
| 4 | **One record, six jobs** | Show breadth without a catalogue | Six tiles — Plan · Collect · Track · See · Prove · Report — each with a 6-second looping clip or live panel and three bullet outcomes. A "see all 26 features" link. |
| 5 | **See it your way** (NEW) | Modern, visual, memorable | A live, interactive strip: pick a chart kind, drag a dashboard tile, switch a map between circles and colours, ask a sentence in the report builder and watch the table fill. This is the Phase 34 work made into the demo. |
| 6 | **From field to donor report** | Prove the chain | One animation: a phone records an activity offline → the value appears on the dashboard → the claim in the draft report cites it → the approver signs. Under it: the three checks (numbers from the record, claims checked, a person approves). |
| 7 | **For your role** | Recognition by role | Seven role cards (we have them) with the *first thing that person sees* as a screenshot. |
| 8 | **Proof** | Credibility | Quote, number or mini case study (only real). A 90-second founder video. Screenshots from our demo programmes, labelled. |
| 9 | **Trust and control** | De-risk for directors and procurement | Row-level isolation, audit trail, encryption, two-step sign-in you can require, data you can export, what we do **not** claim (no certification). Link to `/security`. |
| 10 | **Plans** | Convert | Plan chooser (section 10), NGO welcome price, free plan first. |
| 11 | **FAQ** | Objections | Includes "Is this a fundraising tool?" (no), "Can we leave with our data?", "Does the AI write the report?" (it drafts; a person approves). |
| 12 | **Final CTA** | Close | "Open a demo programme" and "Book a 20-minute walkthrough". |

Rules for every section: one idea, one picture, one line of proof; plain words; no claim without a source in `02-feature-inventory.md`; every screenshot labelled as demo data.

---

## 7. Solutions pages: one template, many pages

Anatomy (each page 600–900 words plus visuals, generated from structured content in `solutions-content.ts`, like `platform-content.ts` today):

1. **Headline in their words** ("Run a WASH programme across three donors without rebuilding the numbers each quarter").
2. **The sector dashboard**, live from the template, with the indicators they already track (WASH: people with access, water points functional, latrines built, hygiene sessions; health: ANC visits, skilled births, stock-outs; nutrition: SAM admissions, cure rate; education: enrolment, attendance, learning outcomes; food security: households reached, food consumption score; protection: cases referred, awareness sessions).
3. **Three problems and how it solves each**, tied to real features.
4. **A day in the life** for the two roles that matter most for that segment.
5. **Reports they owe** (donor formats typical in the sector), phrased as "bring your donor's template" — **no donor names or logos without permission and accuracy**.
6. **Proof** (a reference or a demo walkthrough), **[needs proof]**.
7. **Start**: "Open the [sector] demo programme" → "Start from this template".

Pages to write first (highest search and sales value): **WASH, health, nutrition, education, food security, protection**; organisation pages for **local/national NGOs** (our priority segment) and **INGO country offices and consortia**; role pages for **M&E officers** and **grants and compliance officers**.

---

## 8. Platform page: from 26 blocks to six jobs

Keep the honest "what to know before you rely on it" notes (a differentiator), but restructure:

- Six sections (Plan, Collect, Track, See, Prove, Report), each: one headline, a 20-second video, three hero capabilities, an expandable "all features in this job".
- **Add the Phase 34 features, which the site does not mention at all:** Chart Studio, Entry Sheet, sector dashboard templates, dashboard tabs/TV mode/print, Maps screen with KML and GeoJSON, report builder with group breakdown, indicator views, bookmarks.
- A **"What's new"** page (a changelog in plain words) proves the product is alive and gives returning visitors a reason to come back.
- A **compatibility panel** ("Works with": KoboToolbox, SurveyCTO, Excel and Google Sheets, Google Drive, your AI assistant through MCP, any tool through the API and webhooks) — only what exists.

Suggested one-line captions for the new features (all true today):

| Feature | Line |
|---|---|
| Chart Studio | Any chart your donor or board might ask for, drawn from your own results, with every editing tool. Charts that would mislead are refused, with the reason. |
| Entry Sheet | Enter results like a spreadsheet: paste from Excel, fill down, work offline, nothing lost. |
| Sector templates | Start a dashboard for WASH, health, nutrition, education, food security or protection, then make it yours. |
| Maps | See results by place, and take the places into Google Earth or your GIS. |
| Report builder | Ask for results across indicators in one sentence, break them down by sex or age group, keep the report, and put it on a dashboard. |
| Wall display | Full-screen dashboards that refresh themselves for the office wall. |

---

## 9. Try it, prove it, trust it

### 9.1 A demo that needs no commitment

- `/demo`: choose a sector, get a pre-filled **read-write sandbox programme** (the demo content seeder exists: `CreateDemoProject`, `DemoContentSeeder`) in a throw-away workspace, with a 5-step guided tour (look at the dashboard, enter a value in the sheet, see it on the map, open a draft report section with its sources, share a link).
- A visible "This is demo data" bar; "Keep this" converts the sandbox into a real workspace with an email address.
- Fallback for visitors who will not sign up even for a sandbox: the existing `/tour`, updated with the Phase 34 screens and a video.
- Needs: abuse limits on sandbox creation, automatic expiry, no real personal data allowed. **[engineering decision: new anonymous-workspace flow; trials are off in production today, so this is a deliberate change]**

### 9.2 Proof we can honestly show

| Asset | Source | Owner action |
|---|---|---|
| Real screenshots and clips from our five demo programmes (Kenya MNCH, Ghana health, Nigeria WASH, Ethiopia MNCH, Sudan MNCH) | `memorybank/demo/` | Pick, anonymise, label "demo data" |
| 90-second founder video | none yet | Record |
| Three named references or case studies | none yet | Get written consent; run a pilot with an approved report |
| "What we do and do not claim" box | `/security`, `AGENTS.md` | Keep current |
| Numbers from real use ("reports approved", "indicator values recorded") | the product database | Only once real customers exist; never invent or round up |

### 9.3 Trust page upgrades

State plainly: where data is hosted, who can read it, how to export it, how to leave, two-step sign-in and that an administrator can require it, the audit log, encryption options, the sub-processor list, what is **not** certified. Add a short security FAQ aimed at procurement and a downloadable one-page summary. Procurement teams in this sector reward plain statements more than badges.

---

## 10. Pricing page

Principles: start from the visitor's situation, show the free plan and the NGO price immediately, and never make them decode credits.

- **A plan chooser at the top**: "How many projects do you run? How many people will use it?" → "Team fits you" (or Starter / Growth / contact us). Three questions at most.
- **Lead with what each plan is for** (the existing taglines are good), then three or four outcomes, then the limits in a collapsible table.
- Move **AI credits and drafts** below the fold with a one-line explanation ("a draft is one report section written from your record; a person approves it").
- **Show the NGO welcome price** next to the list price from the first screen, and say how it is verified.
- **Annual toggle** with "2 months free" (already in the data).
- **Add:** "What happens to my data if I stop?" (kept, exportable), "Can I bring my own AI provider?" (Growth), a procurement box for larger organisations (invoice, DPA, security review), and a visible refund link.
- **Decision for you (section 15):** the entry paid plan is $79 a month. For very small local organisations that may be high. Options: a smaller "Community" tier, a verified-grassroots discount larger than 25%, or sponsored seats. This is a commercial decision, not a design one.

---

## 11. Visual and interaction direction ("state of the art")

**Principles:** clear before clever; the product is the hero; fast on weak connections; accessible to everyone; warm and credible, not startup-glossy.

| Area | Recommendation |
|---|---|
| **Look** | Keep the teal/saffron identity and the serif headline voice (it is distinctive in this category), but make the site **light-first with a dark-mode toggle** (the product is light-first; a dark marketing site next to a light product feels like two products). Larger type, generous space, one accent per section. |
| **Product as hero** | Use **real UI**, drawn live by our own components with demo data (charts, maps, the sheet), inside clean device frames. No stock photography of generic offices. If imagery of people is wanted, use consented, locally relevant, dignified photography with credit (never beneficiary images without explicit consent; no "poverty imagery"). |
| **Interaction** | The sector chooser; a hover/click "explore the dashboard" panel; a scrubbable timeline for the programme cycle; short looping clips (under 400 KB each, with a still fallback). Respect `prefers-reduced-motion` (already honoured). |
| **Layout** | A bento grid for the six jobs; sticky sub-navigation on long pages; comparison tables that collapse on mobile. |
| **Performance** | Budget: LCP under 2.0 s on a mid-range phone over 3G-class, total home page under 300 KB before interaction, no layout shift, the live panels load on interaction or when visible. Our audience is often on slow, expensive data. |
| **Accessibility** | WCAG 2.2 AA, tested with a screen reader and keyboard; captions on every video; contrast tokens from the product's design system (already tested). |
| **Languages** | English first. French, Spanish and Arabic marketing pages after a **native review** (the product translations are drafts); right-to-left layout checked for Arabic. `hreflang` for each. Do not machine-translate the legal pages. |
| **Content tone** | Short sentences, concrete nouns, dignified language about the people programmes serve ("participants", "people reached"), no hype. |
| **Fonts and assets** | Self-host fonts (the home page loads Google Fonts today, which is a privacy and speed cost); compress images to AVIF/WebP; one icon set. |

---

## 12. Search, content and the lead engine

Search intent we can serve honestly, each with a page or guide:

- *logframe software / logframe template / logical framework example*
- *M&E software for NGOs / indicator tracking tool / monitoring and evaluation platform*
- *donor reporting software / grant reporting for NGOs / how to write a donor report*
- *KoboToolbox to dashboard / KoboToolbox integration / offline data collection for NGOs*
- *WASH / health / nutrition indicators list* (the indicator bank)
- *grant management for implementing partners / sub-grantee reporting*
- *humanitarian dashboard template / project dashboard for NGOs*

**Lead magnets that are also product demos** (each gated by an email only if the user wants a copy by email; the download itself never needs one):

1. **Logframe + indicator starter pack by sector** (Excel and a one-click "start from this in DonorDesk").
2. **The donor report readiness checklist** (what each major donor type usually asks for; framed as a guide, not as any donor's rule).
3. **Indicator bank** (a searchable list by sector; also the strongest feature to build next).
4. **Dashboard template gallery** (the six sector templates, viewable without sign-up).

Publish one useful guide a fortnight from the support articles we already have (they are factual and specific), and a public **changelog**. A sitemap and structured data (organisation, software application, FAQ) go in at launch.

Channels that fit this audience: LinkedIn, humanitarian practitioner communities and newsletters, webinars with partners, **WhatsApp** as a contact option (heavily used in the sector), and a "Book a 20-minute walkthrough" calendar link.

---

## 13. Measurement and experiments

The site has no analytics today. Add **privacy-friendly analytics** (no cross-site tracking; consistent with the cookie banner) and track:

`landing → sector chosen → demo opened → demo step 3 reached → sign-up started → workspace created → first project → first value recorded → report draft → paid`

Experiments, one at a time, in this order: (1) hero promise A / B / C; (2) with and without the sector chooser; (3) "Open a demo" vs "Create a free workspace" as the primary button; (4) plan chooser vs table; (5) video in the hero vs product panel. Success is measured against the existing marketing goals G1–G4 (qualified sign-ups, activation, reports approved, paid conversion), not page views.

---

## 14. Build plan

Sized for one engineer and one writer; each step ships on its own (`SCOPE=web`).

| Step | What | Depends on | Effort |
|---|---|---|---|
| **W0** | Decisions and assets (section 15); add analytics; refresh `02-feature-inventory.md` with Phase 34 | owner | 2–3 days |
| **W1** | New hero with sector chooser and live panel; new home sections 3–6; light theme and tokens; performance pass; self-hosted fonts | W0 | 1.5–2 weeks |
| **W2** | Platform page restructured into six jobs, Phase 34 features added, What's new page | W1 | 1 week |
| **W3** | Solutions template + the first 8 pages (6 sectors, local NGO, INGO/consortia) | W1, copy | 1.5 weeks + writing |
| **W4** | `/demo` sandbox + guided tour; updated `/tour` with video | engineering decision on anonymous workspaces | 1.5–2 weeks |
| **W5** | Pricing chooser and restructure; trust page upgrades; compare pages | owner pricing decision | 1 week |
| **W6** | Resources: template gallery, indicator bank (v1), guides, changelog; SEO structured data | content | 2 weeks |
| **W7** | French, Spanish, Arabic marketing pages after native review; RTL check | reviewers | 1.5 weeks |
| **W8** | Experiments and iteration from analytics | W0 | ongoing |

A credible first release is **W0 + W1 + W2**: about four weeks, and it already changes the first impression and shows the new product.

---

## 15. Decisions and inputs I need from you

**Decisions**

1. **Donation-based:** is the target *programmes that report to funders* (what the product does), or do you also want to serve *fundraising from individual donors*? If yes, that is a product decision (a bridge or integration), not a website one.
2. **Priority segment for the hero default:** the marketing plan says local and national NGOs. Keep, or lead with INGO country offices and consortia?
3. **Anonymous sandbox:** are you willing to allow throw-away demo workspaces without sign-up (needs abuse limits)? If not, the demo is the tour plus a video.
4. **Pricing:** keep $79 as the entry paid plan, add a smaller community tier, or enlarge the verified-NGO discount?
5. **Theme:** light-first with dark toggle (recommended) or keep the dark editorial look?
6. **Languages first:** which of French, Spanish, Arabic matters most for the next six months?
7. **Compare pages:** do you want named competitor comparisons? If yes, each claim must be verified from the competitor's public material at the time, and re-checked every quarter; otherwise compare against *spreadsheets and stitched-together tools* only.

**Assets and actions (yours)**

- Consent for at least one named reference; permission to quote.
- A founder video (90 seconds) and a photo for an About page.
- A decision on who answers "Book a walkthrough" and a WhatsApp number if wanted.
- Native reviewers for fr / es / ar.
- Someone to try the Phase 34 screens in the signed-in app, so the new pages can show them truthfully (still outstanding).

**Risks and rules**

- Public claims stay inside `02-feature-inventory.md`; the new features must be checked by a person before the site shows them as working (AGENTS.md, "Public copy stays honest").
- No donor names, logos or "approved by" implications without permission and accuracy.
- No invented numbers, testimonials or logos, ever. Demo data is always labelled.
- The sandbox must never mix demo and real personal data, and must expire.
- Page weight and accessibility are acceptance criteria, not polish.

---

## Appendix A. Copy to start from

**Hero (default):** *Run every grant, and prove it, in one place.*
**Sub-head:** *Plan the work, collect data in the field, even offline, watch every indicator on dashboards and maps, keep the evidence beside it, and draft the donor report from the same record. A person approves every report.*

**Sector line examples (swap under the hero when a chip is chosen):**

- WASH: *Water points working, people with access, hygiene sessions held, across every donor, in one view.*
- Health: *Antenatal visits, skilled births and stock-outs by district, with the evidence behind each figure.*
- Nutrition: *Admissions, cure rates and defaulters by site, and the report your donor asked for.*
- Education: *Enrolment, attendance and learning results by school and term.*
- Food security: *Households reached, what they received, and how their food security changed.*
- Protection: *Cases referred, sessions held and risks reviewed, with confidentiality kept.*

**"Sound familiar?" cards:** *The report is due and the numbers are in six places.* · *Three donors, three formats.* · *The field team has no signal.* · *Nobody can say which activities are late.* · *The evidence is in chat threads.*

**Calls to action:** *Open a demo programme* (primary) · *Create a free workspace* · *Book a 20-minute walkthrough* · *See the sector dashboards*.

## Appendix B. What to update alongside

`02-feature-inventory.md` (add the Phase 34 features with LIVE / LIVE-LIMIT status after a person checks them), `06-selling-points.md` (add selling points 41+ for Chart Studio, Entry Sheet, sector templates, maps, report builder), `04-website-redesign-brief.md` (replace by this plan once approved), `05-overhaul-changelog.md`, and the support drafts in `docs/support/_unpublished-phase34/` (publish after the signed-in check).

---

## Implementation status (2026-10-28)

Owner decisions taken: fundraising is served through infographics and shareable results (not a donor CRM); all segments; anonymous demo allowed (**not built yet**); pricing to be decided later (today's plans shown, generated from `PLAN_CATALOG`); light first; English first with a language switcher; a competitor comparison page.

**Built and deployed (web only):**
- New light-first public site under `apps/web/src/components/site/` (scoped `.sx` styles, self-hosted fonts, light by default and a dark choice kept on the device).
- **Home** (`app/page.tsx`): the stable promise, sector chooser with a live example dashboard, six jobs, "See it your way" demo, field-to-report walkthrough, supporters and infographics section, roles, sector links, trust, plans, learn more, FAQ, closing call to action. All figures are example data and labelled.
- **Solutions** (`/solutions`, `/solutions/[sector]`): WASH, health, nutrition, education, food security, protection.
- **Compare** (`/compare`): only what each vendor publishes on its own site (built for, price as published, how you start), with sources and the date last read (28 Oct 2026). No feature-by-feature scoring of competitors, because we cannot verify it.
- **Header** with the language switcher (English; French, Spanish and Arabic strings exist only for the header and hero and are unreviewed drafts) and a theme toggle.
- Sitemap, navigation links and the older dark pages' cross-links updated; the old home components were removed.
- Pricing parity tests now follow the catalogue (home cards come from `homePlans()`); the pricing page's Enterprise annual row now states the $12,000 floor, which also cleared the one long-standing failing test.

**Not built yet (from sections 6–13):** the no-sign-up demo sandbox (the hero links to the product tour instead); a restructured Platform page and What's new; customer logos, quotes, a founder video and references (placeholders were removed, nothing invented); the indicator bank and downloadable starter packs (the Learn more section links only to things that exist); French, Spanish and Arabic pages beyond the header and hero; the pricing plan chooser; privacy-friendly analytics; the older dark pages (features, pricing, tour, security) restyled to match.

### Follow-up (2026-10-28, same day)
- **/compare is now a dedicated, extensive matrix** (`components/site/compare-data.ts`, `CompareMatrix.tsx`): DonorDesk beside ActivityInfo, DevResults, TolaData, KoboToolbox and spreadsheets across price and start-up, planning, data collection, dashboards and maps, donor reporting, evidence and audit, people and access, integrations and API, and security. Every cell says only what the vendor's own pages state (read 28 October 2026; sources listed on the page); "not stated" means we did not find it, not that it is absent. A "Where DonorDesk is behind today" section names the gaps (no certification, no signature or barcode questions, lighter finance and no IATI, fewer interface languages, no native BI connectors, newer product). Re-read the sources and update `CHECKED` every quarter.
- **/platform is its own page** (the six jobs and how they fit); **/features is the full catalogue** (now in the new light frame, with Entry Sheet, Chart Studio, sector dashboards and report builder added). The header has both Platform and Features.
- **Security, contact-sales and the tour now have the site header and footer.** Pricing, support and the legal pages still use the older dark header and are the next to move.
