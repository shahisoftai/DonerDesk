# Website Redesign Brief (donordesk.online)

**Status:** Implemented in this overhaul (October 2026). This brief is the spec the code follows; update both
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
| 1 | Hero | — | Eyebrow "Programme management for grant-funded work". H1 **Run your programme. Report from the record.** Sub-line naming logframe, indicators, activities, evidence and compliance; reports come from the recorded work, checked and approved by people. CTAs: Create a free workspace; Take the product tour. Micro-line: no card, demo project included, people approve every output. |
| 2 | Programme preview | — | A labelled **sample** project card: activities accepted, indicators reported, evidence verified, readiness, a sourced sentence, and open blockers. |
| 3 | Sectors strip | — | Sectors served (health, nutrition, WASH, protection, education, livelihoods, shelter, food security, and more). |
| 4 | The record, plan to report | `system` | Four stages: **Plan**, **Record**, **Check**, **Report**, each with two or three inventory-backed lines. |
| 5 | Run the programme | `features` | Six module cards: Logframe and indicators; Activity capture; Data Center; Evidence library; Team and roles; My Work. |
| 6 | Report from the record | `reporting` | Four cards: Donor templates; Sourced drafting; Checks before submission; Approval and export. Link to `/features`. |
| 7 | How it works | `how-it-works` | Six steps, management first: set up the project; build the logframe and indicators; record activities and evidence as you go; track compliance and readiness; draft, check and approve; export and submit yourself. |
| 8 | Who it's for | `who-its-for` | Five segments (humanitarian and development, research and public health, government programmes, education and skills, climate and social impact) and the seven roles. |
| 9 | Pricing teaser | `pricing` | The four plans with the figures from `plan.ts`; NGO terms; link to the full comparison. |
| 10 | Trust and security | `security` | Tenant isolation, audit log, AI traceability, least-privilege roles, published DPA and subprocessors. No certifications claimed. |
| 11 | FAQ | `faq` | Updated (see section 5). |
| 12 | Closing CTA | — | **Make the programme and the report one piece of work.** Get started free; Log in. |

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

- Home title: "DonorDesk: run your programme, report from the record".
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
