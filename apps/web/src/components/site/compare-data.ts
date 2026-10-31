/**
 * The comparison matrix. Rule: a cell says only what the vendor's OWN public pages state (or, for DonorDesk, what the product does today).
 * "unknown" means we did not find it on the pages we read; it does not mean the tool lacks it. Re-read the sources every quarter and
 * update CHECKED. Never copy a competitor claim from a review site or from memory.
 */
export const CHECKED = "28 October 2026";

export type Level = "yes" | "partial" | "no" | "unknown";
export interface Cell { level: Level; text: string }
export type VendorId = "dd" | "ai" | "dr" | "tola" | "kobo" | "sheet";

export interface Vendor { id: VendorId; name: string; summary: string; site?: string }
export const VENDORS: Vendor[] = [
  { id: "dd", name: "DonorDesk", summary: "Running a funded programme and reporting on it: plan, collect, track, prove and report in one record." },
  { id: "ai", name: "ActivityInfo", summary: "A web-based information management system for collecting, analysing and sharing data, used for monitoring and evaluation, case management, humanitarian coordination and cash and voucher assistance.", site: "https://www.activityinfo.org" },
  { id: "dr", name: "DevResults", summary: "\"The most advanced and flexible monitoring & evaluation software for international development\", with project maps, progress monitoring and collaboration with donors and partners.", site: "https://devresults.com" },
  { id: "tola", name: "TolaData", summary: "\"The end-to-end solution for portfolio and project impact management\": plan, collect, analyse and share impact data in one platform.", site: "https://www.toladata.com" },
  { id: "kobo", name: "KoboToolbox", summary: "A tool for building forms and collecting survey data, online or offline. Its documentation says it is free for humanitarian organisations.", site: "https://www.kobotoolbox.org" },
  { id: "sheet", name: "Spreadsheets and email", summary: "Anything, one file at a time." },
];

const y = (text: string): Cell => ({ level: "yes", text });
const p = (text: string): Cell => ({ level: "partial", text });
const n = (text: string): Cell => ({ level: "no", text });
const u = (): Cell => ({ level: "unknown", text: "" });

export interface MatrixRow { label: string; cells: Record<VendorId, Cell> }
export interface MatrixSection { id: string; title: string; intro: string; rows: MatrixRow[] }

export const SECTIONS: MatrixSection[] = [
  { id: "price", title: "Price and getting started", intro: "As each vendor publishes it. Prices change; check the vendor before you budget.", rows: [
    { label: "Price as published", cells: {
      dd: y("A free plan. Team $79 a month, Growth $149 a month, Enterprise from $12,000 a year. Verified NGOs get 25% off the first year."),
      ai: y("Solo from €545 a year (1 user, 1 database). Programme from €3,700 a year (5 full and 15 basic users, unlimited databases). Enterprise Agreement by quote (at least 250 users). Extra users cost €55 to €75 a year."),
      dr: y("A set-up fee plus an annual subscription by programme size: from $33,800 and $28,000 a year for programmes up to $5M. Unlimited user licences. Training is billed separately."),
      tola: y("Lite €69 a month (2 users), Essential €499 a month (20 users), Custom from €899 a month (40 users), minimum 12 months, excluding VAT. Other regular and NGO plan sets are also shown."),
      kobo: p("A free Community plan for eligible nonprofits; paid Professional, Teams and Enterprise plans. Limits and prices are on its own site."),
      sheet: y("Free."),
    } },
    { label: "Starting up", cells: {
      dd: y("Create a workspace yourself in minutes. An onboarding call comes with the Growth plan."),
      ai: y("Guided onboarding is included in all plans, per its pricing page."),
      dr: y("Vendor-led: a set-up and configuration fee that covers a baseline assessment and help building your site."),
      tola: y("A 1-hour configuration call comes with Essential; configuration and training are optional add-ons."),
      kobo: u(),
      sheet: y("Open a file."),
    } },
    { label: "Users", cells: {
      dd: y("Seats by plan. Viewers do not use a paid seat on Team and above."),
      ai: y("Full and basic users by plan; Enterprise has no limit on users."),
      dr: y("Unlimited user licences, including partners and funders."),
      tola: y("By plan: 2, 20 or at least 40 users."),
      kobo: u(),
      sheet: y("Anyone with the file."),
    } },
    { label: "Hosting", cells: {
      dd: y("Hosted service on a Contabo data centre."),
      ai: y("Software as a service on Google Cloud, or a self-managed server."),
      dr: y("Microsoft Azure."),
      tola: u(),
      kobo: u(),
      sheet: y("Wherever the file sits."),
    } },
  ] },

  { id: "plan", title: "Planning and results", intro: "Setting up what the programme will do and measure.", rows: [
    { label: "Results framework or logframe", cells: {
      dd: y("Goals, outcomes, outputs and activities, with parents and codes. Import from Excel, CSV or text."),
      ai: y("Evaluates impact \"at any level of a results framework\"."),
      dr: y("\"Set up a results framework and define indicators.\""),
      tola: y("Levels from goal and impact to activities and inputs, with cause-and-effect between levels."),
      kobo: u(),
      sheet: p("By hand."),
    } },
    { label: "Indicators, baselines and targets", cells: {
      dd: y("Baseline, target, frequency and aggregation set once; scheduled targets across periods."),
      ai: p("Tracks \"key indicators\" from outputs to impact. Its M&E page does not mention targets."),
      dr: y("Set targets at programme and project level; baselines and targets in its help centre."),
      tola: y("Links data to indicators to \"monitor against targets\"."),
      kobo: u(),
      sheet: p("By hand."),
    } },
    { label: "Disaggregation (sex, age, other)", cells: {
      dd: y("Breakdowns by sex, age group, disability, location or other group, with group targets."),
      ai: p("Calculated fields compute \"aggregated and disaggregated figures\"."),
      dr: y("\"Disaggregate data by customizable factors.\""),
      tola: y("Aggregated results can be analysed by disaggregation types."),
      kobo: u(),
      sheet: p("By hand."),
    } },
    { label: "Roll-up across projects", cells: {
      dd: y("Portfolio overview, programmes and grants; an indicator counted elsewhere is never added twice."),
      ai: y("\"Rolling up data from project to global level.\""),
      dr: y("Overview of all projects on a map, with results and finance."),
      tola: y("Aggregating indicators combine results from several projects, with custom formulas."),
      kobo: u(),
      sheet: n("Rebuilt each time."),
    } },
    { label: "Calculated (formula) indicators", cells: {
      dd: y("A ratio, total or difference of other indicators, calculated exactly; a missing part means \"not measured\"."),
      ai: y("Calculated fields and formulas."),
      dr: u(),
      tola: y("Custom formulas on aggregating indicators."),
      kobo: u(),
      sheet: y("Formulas."),
    } },
    { label: "Work plan, milestones and calendar", cells: {
      dd: y("Work plan with timeline, calendar, milestones, dependencies and delivery status."),
      ai: u(),
      dr: y("Workplan overview with milestones, deliverables, reporting periods and calendar events."),
      tola: u(),
      kobo: u(),
      sheet: p("By hand."),
    } },
    { label: "Risks and changes of plan", cells: {
      dd: y("A risk register with owners and review dates, and dated records of changes of plan."),
      ai: u(),
      dr: u(),
      tola: u(),
      kobo: u(),
      sheet: p("By hand."),
    } },
    { label: "Budgets, expenses and funding", cells: {
      dd: y("Budget lines and expenses beside results, plus a finance register: funding sources, disbursements and money received in several currencies with dated rates. Entries are decided by a person before they count."),
      ai: u(),
      dr: y("Budgets with any number of line items, disbursements and expenses, multiple funding sources, multiple currencies."),
      tola: p("Financial data is included in its IATI export."),
      kobo: u(),
      sheet: p("By hand."),
    } },
  ] },

  { id: "collect", title: "Data collection", intro: "Getting data from the field into the record.", rows: [
    { label: "Form designer", cells: {
      dd: y("Forms with conditional rules, photo and document questions, GPS, place questions and public links."),
      ai: y("Form designer with calculated fields and validation rules."),
      dr: p("Data entry and data tables in the application; for field collection it integrates with other tools."),
      tola: y("A built-in form builder; forms can be copied and shared as web links."),
      kobo: y("Form builder and XLSForm."),
      sheet: n("No."),
    } },
    { label: "Offline mobile collection", cells: {
      dd: y("Forms and activity records work offline once the app has been opened online, and send when a signal returns."),
      ai: y("Works offline with two-way sync, GPS, photos, signatures and barcode scanning."),
      dr: n("Web-based; needs an internet connection. It integrates with offline mobile collection tools."),
      tola: u(),
      kobo: y("\"Collect data offline or online.\""),
      sheet: n("No."),
    } },
    { label: "Signatures and barcode scanning", cells: {
      dd: n("Not available."),
      ai: y("Stated on its mobile page."),
      dr: u(),
      tola: u(),
      kobo: u(),
      sheet: n("No."),
    } },
    { label: "Public collection links", cells: {
      dd: y("Shareable form links that expire and can be withdrawn."),
      ai: y("Collection links."),
      dr: u(),
      tola: y("A webform link for data collectors."),
      kobo: u(),
      sheet: n("No."),
    } },
    { label: "Bring in data from other collection tools", cells: {
      dd: y("KoboToolbox and SurveyCTO submissions arrive as records you review; Excel imports throughout."),
      ai: y("Spreadsheet importer and XLSForm import."),
      dr: y("Excel import and export; a help article on importing from KoboToolbox."),
      tola: y("API imports from Ona, KoboToolbox and Google Drive; CSV imports from SurveyCTO, CommCare, ODK and Excel."),
      kobo: u(),
      sheet: y("Copy and paste."),
    } },
    { label: "Spreadsheet-style entry", cells: {
      dd: y("An entry sheet: paste from Excel, fill down, undo, autosave, offline queue, Excel round trip."),
      ai: y("Interactive tables and a validating spreadsheet importer."),
      dr: y("Data entry, data tables and a bulk import tool."),
      tola: y("Data tables to import, organise and clean data."),
      kobo: u(),
      sheet: y("Native."),
    } },
    { label: "Review before data counts", cells: {
      dd: y("Values move from draft to handed in to verified; records from forms are reviewed before they count; approved periods lock."),
      ai: y("Draft records, and results can be locked once reported to the donor."),
      dr: u(),
      tola: p("Data approval is listed on its Custom plans."),
      kobo: u(),
      sheet: n("No."),
    } },
  ] },

  { id: "see", title: "Dashboards, charts and maps", intro: "Seeing and sharing results.", rows: [
    { label: "Dashboards", cells: {
      dd: y("Dashboards from sector templates (WASH, health, nutrition, education, food security, protection), tabs, a wall-screen mode and print."),
      ai: y("Dashboards that pair visualisations with tables, with slicers."),
      dr: y("An overview dashboard with all projects on a map, finance, results charts and alerts."),
      tola: y("Configurable dashboards that update automatically when new data arrives."),
      kobo: p("Reports and data visualisation for a project."),
      sheet: p("Charts by hand."),
    } },
    { label: "Chart choice and editing", cells: {
      dd: y("More than 40 kinds in a Chart Studio with full editing; a chart that would mislead is refused with the reason."),
      ai: y("Bar and line charts, pivot tables and notebooks."),
      dr: y("Graphical charts of progress for projects or the whole programme."),
      tola: y("Charts, graphs, narratives and images on dashboards."),
      kobo: u(),
      sheet: y("Native, by hand."),
    } },
    { label: "Maps", cells: {
      dd: y("Results by place: circles sized by value, coloured countries, rankings; KML and GeoJSON downloads; a map of planned work."),
      ai: y("Interactive and thematic maps with a built-in geographic database."),
      dr: y("Interactive mapping, custom map layers, KML export, bulk place import and automatic assignment to provinces and districts."),
      tola: u(),
      kobo: u(),
      sheet: n("No."),
    } },
    { label: "Ask a question across indicators", cells: {
      dd: y("A report builder: ask in one sentence, break down by sex or age group, save it and put it on a dashboard."),
      ai: y("Pivot tables across one or several forms, with sums, averages and counts."),
      dr: y("\"Create, save and share customized reports.\""),
      tola: u(),
      kobo: u(),
      sheet: y("Pivot tables."),
    } },
    { label: "Ask your records a question", cells: {
      dd: y("Ask in plain language; the answer is built only from your records and names the source behind each statement, and it says so when the records do not answer."),
      ai: u(),
      dr: u(),
      tola: p("AI features (a knowledge database, a data analytics assistant) are described as in pilot."),
      kobo: u(),
      sheet: n("No."),
    } },
    { label: "Share outside the organisation", cells: {
      dd: y("Read-only links and embeds for dashboards and infographics, with expiry; finance is never shown through a link."),
      ai: y("Publish reports online, embed them on websites or share a public page."),
      dr: u(),
      tola: y("Dashboards shared by a URL."),
      kobo: u(),
      sheet: y("Send the file."),
    } },
    { label: "Infographics for supporters and donors", cells: {
      dd: y("A one-page infographic studio in four languages, with share links."),
      ai: u(),
      dr: y("Infographics for budget breakdown, burn rates and outstanding advances."),
      tola: u(),
      kobo: u(),
      sheet: p("Slides by hand."),
    } },
  ] },

  { id: "report", title: "Donor reporting", intro: "Turning the record into reports.", rows: [
    { label: "Report drafted from the record", cells: {
      dd: y("Drafts for each section of a donor template, written from the record with the source of each statement shown; a person approves."),
      ai: p("A report designer; its pages do not mention donor reports or narrative drafting."),
      dr: y("Custom reports, report templates and templates for document exports."),
      tola: p("AI report generation is described as a pilot with wider availability planned for late 2026 and 2027."),
      kobo: u(),
      sheet: n("Written by hand."),
    } },
    { label: "Donor template structure", cells: {
      dd: y("Upload a Word, PDF or Excel template once; sections, questions and word limits are extracted for review and reused."),
      ai: u(),
      dr: p("Standard forms automatically populated with project information."),
      tola: u(),
      kobo: u(),
      sheet: n("By hand."),
    } },
    { label: "Checks before submission", cells: {
      dd: y("Claims checked against the record, readiness and compliance checklists, a second-approver rule, and sealed submissions."),
      ai: u(),
      dr: p("Checklists with due dates and a \"complete & approved\" sign-off."),
      tola: u(),
      kobo: u(),
      sheet: n("No."),
    } },
    { label: "IATI publishing", cells: {
      dd: n("Not yet. It is planned."),
      ai: u(),
      dr: y("Describes itself as fully IATI-compliant, with export to the IATI format."),
      tola: y("Publishing and validating IATI datasets to the registry; listed as an add-on."),
      kobo: u(),
      sheet: n("No."),
    } },
    { label: "Exports", cells: {
      dd: y("Word and PDF reports, Excel and CSV data, an evidence pack and a full organisation export."),
      ai: p("Data export for analysis in tools such as R and Python; export formats are not named on the pages we read."),
      dr: y("Excel export and document exports from templates."),
      tola: u(),
      kobo: y("Exporting and downloading data, with advanced export options."),
      sheet: y("Native."),
    } },
  ] },

  { id: "prove", title: "Evidence, quality and audit", intro: "Standing behind the numbers.", rows: [
    { label: "Evidence linked to what it proves", cells: {
      dd: y("Files linked to the activity or value they prove, with verification, confidentiality levels and text extraction."),
      ai: p("Attachments with preview."),
      dr: y("A document library per project, in folders; a photo gallery with captions and dates."),
      tola: u(),
      kobo: u(),
      sheet: p("Folders."),
    } },
    { label: "Change history and audit log", cells: {
      dd: y("A tamper-evident audit log; every value keeps its history."),
      ai: y("An audit log of every change and record history, kept until the database is deleted."),
      dr: y("A full change history showing who changed what and when."),
      tola: u(),
      kobo: u(),
      sheet: p("Version history in some tools."),
    } },
    { label: "Notes and comments", cells: {
      dd: y("Comments on indicators, activities, reports and statements, with mentions."),
      ai: u(),
      dr: y("A running log of notes and comments, emailed to linked staff."),
      tola: y("A discussion feature on Essential plans."),
      kobo: u(),
      sheet: p("Email."),
    } },
    { label: "Reminders and automations", cells: {
      dd: y("A daily summary per person, late-work reminders, and assignments from one queue."),
      ai: y("Email notifications, webhooks and an automation builder."),
      dr: y("Alerts for overdue milestones and over-budget projects; upcoming task notifications."),
      tola: u(),
      kobo: u(),
      sheet: n("By hand."),
    } },
  ] },

  { id: "access", title: "People, partners and access", intro: "Who can see and change what.", rows: [
    { label: "Roles and permissions", cells: {
      dd: y("Seven roles per project, and a second-approver rule."),
      ai: y("Permissions per folder, form or subform, with roles and record-level conditions."),
      dr: y("Groups with permissions per data category: full, view-only or none."),
      tola: u(),
      kobo: y("Project-level and user-level sharing permissions."),
      sheet: p("File permissions."),
    } },
    { label: "Outside partners", cells: {
      dd: y("Partners limited to named projects and to the routes they need."),
      ai: y("External partner reporting on Programme and Enterprise plans."),
      dr: y("Unlimited users, including partners and funders."),
      tola: u(),
      kobo: u(),
      sheet: p("Share a copy."),
    } },
    { label: "Interface languages", cells: {
      dd: p("English, French, Spanish and Arabic; the translations are still being reviewed."),
      ai: p("Multi-lingual forms and automatic translations; interface languages are not listed on the pages we read."),
      dr: y("Arabic, Burmese, Chinese, Dutch, French, Nepalese, Portuguese, Russian, Spanish and Ukrainian."),
      tola: u(),
      kobo: y("Translations for forms, and collecting data in several languages."),
      sheet: p("Depends on the software."),
    } },
  ] },

  { id: "connect", title: "Integrations and API", intro: "Connecting to the tools around it.", rows: [
    { label: "API", cells: {
      dd: y("A public read-only API with keys and scopes, plus signed webhooks."),
      ai: y("A JSON-based, mostly RESTful API that can query, add, edit and delete records and manage users; an R client library."),
      dr: y("An API that enables many integrations, documented in its knowledge base."),
      tola: u(),
      kobo: y("An API, with a getting-started guide."),
      sheet: n("No."),
    } },
    { label: "Connect AI assistants", cells: {
      dd: y("An MCP server with read-only tools for projects, indicator values and results by place."),
      ai: y("An MCP server to connect assistants such as Claude, ChatGPT and Gemini."),
      dr: u(),
      tola: p("AI features (a knowledge database, a data analytics assistant, report generation) are described as in pilot."),
      kobo: u(),
      sheet: n("No."),
    } },
    { label: "Business intelligence and GIS tools", cells: {
      dd: p("Through the API and exports. No native Power BI or GIS connector."),
      ai: y("Power BI, Python, R, ArcGIS Online and QGIS."),
      dr: u(),
      tola: y("Power BI, Tableau and Apache Superset are named on its home page."),
      kobo: u(),
      sheet: y("Excel and exports."),
    } },
  ] },

  { id: "trust", title: "Security and trust", intro: "What each vendor says about protecting data.", rows: [
    { label: "Single sign-on", cells: {
      dd: p("SSO and SCIM on the Enterprise plan."),
      ai: y("Azure AD, Google Workspace and Okta."),
      dr: u(),
      tola: p("Listed as an optional add-on on Custom plans."),
      kobo: u(),
      sheet: n("No."),
    } },
    { label: "Two-step sign-in", cells: {
      dd: y("Available to staff; an administrator can require it for everyone."),
      ai: y("Organisation-wide two-factor requirements can be enforced."),
      dr: u(),
      tola: y("Multi-factor authentication on Essential plans."),
      kobo: u(),
      sheet: n("Depends on the software."),
    } },
    { label: "Data isolation and encryption", cells: {
      dd: y("Each organisation's data is separated in the database itself; encryption options for stored files."),
      ai: y("Data encrypted in transit and at rest; TLS 1.2 or higher."),
      dr: p("Passwords and critical data protected to industry standards; encryption methods are not stated."),
      tola: u(),
      kobo: p("A \"Data Security & Protection\" section is in its documentation."),
      sheet: n("Depends on where the file sits."),
    } },
    { label: "Backups", cells: {
      dd: y("Scheduled, encrypted backups with restore tests; no point-in-time recovery."),
      ai: y("Automated backups across several replicas; deleted databases kept at least 60 more days."),
      dr: y("Continuous backups kept at least 30 days, in several locations."),
      tola: u(),
      kobo: u(),
      sheet: n("By hand."),
    } },
  ] },
];
