# Website Redesign Brief (donordesk.online)

**Status:** Implemented in this overhaul (October 2026), homepage concept updated 2026-10-18 (commit `f8b6785`, release `20261018051329`). This brief is the spec the code follows; update both
together. Copy is from `03-positioning-and-messaging.md`; facts are from `02-feature-inventory.md`.

## 1. Problem with the previous site

- The hero, the six feature cards and the FAQ described a report writer. The management layer was missing.
- "How it works" started at report setup, not at the programme.
- No dedicated features page, so the depth of the product (activities, Data Center, My Work, evidence) was not visible.
- The FAQ answered "What is DonorDesk?" as a reporting platform only.

## 2. Information architecture

| Route | Purpose | Status |
|---|---|---|
| `/` | Home: the category, the record from plan to report, the modules, pricing teaser, trust, FAQ | Rewritten |
| `/features` | Every module, what it does, who uses it, the limits stated plainly | New |
| `/pricing` | Plan comparison (figures from `plan.ts`) | Metadata updated |
| `/tour` | Narrated product tour | Unchanged |
| `/security` | Trust and security detail | Unchanged |
| `/contact-sales` | Enterprise and pilots | Unchanged |
| `/support` | Support Center | Content updated (see changelog) |
| `/signup`, `/login` | Conversion | Unchanged |

Navigation (all marketing pages): **Features · How it works · Who it's for · Pricing · Security · Support**, then
**Log in** and **Get started**. "How it works" and "Who it's for" link to the home page sections; "Features" is
its own page.

## 3. Home page, section by section

| # | Section | Id | Content |
|---|---|---|---|
| 1 | Hero | — | Eyebrow "Programme management for NGOs". Three statements rotate every 3 seconds (pause on hover or focus; off with reduced motion): **Your whole programme, in one place.** / **Know where your programme stands before the donor asks.** / **Stop rebuilding the programme every quarter.** Each has its sub-head (see `03`, section 3). CTAs: Create a free workspace; Take the product tour. Check-marked trust row: no card, demo project included, each organisation's data isolated. Statement dots sit at the bottom of the text column. The cycle visual (Plan, Deliver, Monitor, Demonstrate around an example project record) sits at the top of the right column. Hero fits one desktop screen (about 800 px tall) above the fold. |
| 2 | Statement band | — | **Know where your programme stands before the donor asks.** Three pillars: Plan what matters; See it while it can change; Prove it when it counts. |
| 3 | The programme cycle | `how-it-works` | Headline "Plan it. Deliver it. Measure it. Prove it." Four tabs: Plan (set the target once), Deliver (record it the same day), Monitor (see the gaps early), Demonstrate (prove it before it's asked). Each tab has three lines and a labelled example panel. Keyboard arrows move between tabs. |
| 4 | Each cycle starts from the last one | — | Four periods, Q1 to Q4: set the baseline, record as you go, correct the course, report from the record. |
| 5 | Reporting | `reporting` | Headline "A donor asks. The answer is already in the record." A sample draft section with source citations, labelled as an example, beside three checks: numbers come from the record, claims are checked, a person approves. Link to `/features`. |
| 6 | Portfolio | `portfolio` | "Every grant kept in its own record." Three example project cards, labelled as examples. |
| 7 | Roles | `who-its-for` | "Each person's part, in one record." The seven roles: Field Officer, Project Manager, M&E Officer, Grants Officer, Compliance Officer, Admin, Viewer. Viewers do not use a seat. |
| 8 | Pricing | `pricing` | Four plans with the figures from `plan.ts` (Starter free; Team $79; Growth $149; Enterprise by contract). Annual two months free; verified nonprofits 25% off Team and Growth in year one. Link to the full comparison. |
| 9 | Trust | `security` | "Your records stay yours." Tenant isolation, hash-chained audit log, AI traceability, published DPA and subprocessor list. No certifications claimed. |
| 10 | FAQ | `faq` | See section 5. |
| 11 | Closing CTA | — | **Stop rebuilding the programme every quarter.** Create a free workspace; Take the product tour. |

The site navigation keeps the anchors `how-it-works` and `who-its-for` so links from other pages still land on the right
section.

## 3a. Visual identity (homepage palette)

The homepage, the Support Center and the shared marketing header and footer use one palette. It is dark-first and the
colours are named tokens in `apps/web/tailwind.config.ts`:

| Token | Hex | Use |
|---|---|---|
| `spruce` / `spruce-2` / `spruce-3` | `#0b1614` / `#10221e` / `#163029` | Page ground, raised panels, tables and tabs |
| `paper` | `#eef2ec` | Headings and primary text |
| `mist` | `#a3b5ad` | Body and secondary text |
| `fog` | `#7d918a` | Captions and tertiary text |
| `saffron` | `#f2b544` | Primary accent, primary buttons (dark text on saffron) |
| `seafoam` | `#3fc1a6` | Plan stage, positive status |
| `skyline` | `#74b8e6` | Monitor stage, informational accents |
| `coral` | `#f08a72` | Demonstrate stage, gaps and open items |

The homepage uses a scoped CSS module (`apps/web/src/components/landing/home/home.module.css`) with the same values. Other
public pages that still use the older blue `brand` scale are listed in `05-overhaul-changelog.md` as open.

## 4. Features page (`/features`)

Hero: "Everything the programme needs, and the report it produces." Then, in order:

1. **Run the programme:** Projects and setup; Logframe and indicators; Activities and field capture; Data Center; Team and roles; My Work.
2. **Keep the evidence:** Evidence library and verification; audit log.
3. **Stay compliant:** Compliance checklist and readiness; the confidentiality gate.
4. **Report from the record:** Donor templates; reporting periods and roll-ups; sourced AI drafting; report editor; review and approval; exports.

Each module: one paragraph on what it does, a short bullet list of what it does in practice, "who uses it", and a
"Good to know" line stating the limit (for example: dictation depends on the browser; offline saving is queued,
not a full offline app; finance is off by default; Enterprise SSO is set up with support). Each module links to
its Support Center article. Closing CTA to the tour and to sign-up.

## 5. FAQ (updated)

- What is DonorDesk? (management first)
- Is DonorDesk just a reporting tool? (no; the reports come from the record)
- Who is DonorDesk for?
- Can DonorDesk produce reports for any donor? (templates in Word, PDF, Markdown, text, Excel or CSV)
- Does the AI invent numbers?
- Can field staff record activities without internet? (queued; the app needs a connection to open)
- Can I keep evidence in my own Google Drive? (yes; linked files do not count toward storage)
- Can I turn AI off?
- How much does DonorDesk cost?
- Which export formats are supported?
- Can DonorDesk submit reports to donors directly? (no)

## 6. Metadata and SEO

- Home title: "DonorDesk: your whole programme, in one place". (Retired: "run your programme, report from the record".)
- Description names the management scope first, then reporting.
- `/features` gets its own title and description; added to the sitemap.
- JSON-LD FAQ stays generated from the same FAQ list the page renders.

## 7. Claims and accessibility rules

- Every claim traces to a `LIVE` line in `02-feature-inventory.md`; `LIVE-LIMIT` lines state the limit where the claim appears.
- No testimonials or logos until approved (none are shown).
- Sample data is labelled "sample" wherever it appears.
- Phone width with no horizontal scroll; body text meets contrast on the dark theme.

## 8. Open items for launch

- Trial flag: decide whether the trial is shown (see `01-marketing-plan.md`, section 10).
- Analytics events for the funnel: set up before launch.
- Reference customers: none shown until approved in writing.
