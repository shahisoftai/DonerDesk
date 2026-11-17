import type { TourChapter, TourRole } from "./public-tour-scenes.ts";

/**
 * English words of the public /tour. `PublicTourBundle` is the shape: a translation is another object typed against it, so a
 * missing scene or chapter does not compile (same pattern as the project wizard's copy). Every claim here is one the product
 * keeps (see AGENTS.md and /features); each scene's `note` is the honest limit, never a promise. Fictional data only.
 */
export interface SceneCopy { title: string; body: string; note: string }

export interface PublicTourBundle {
  heading: string;
  lede: string;
  chapters: Record<TourChapter, { name: string; promise: string }>;
  roles: Record<TourRole, { name: string; line: string }>;
  ui: {
    allRoles: string; rolePrompt: string; chapterNav: string; sceneOf: string; back: string; next: string; start: string;
    goodToKnow: string; seeFeature: string; tryIt: string; phoneNote: string; sampleNote: string; finalTitle: string; finalBody: string;
    compare: string; screenAlt: string;
  };
  scenes: Record<string, SceneCopy>;
}

export const PUBLIC_TOUR_EN: PublicTourBundle = {
  heading: "Take the DonorDesk tour",
  lede: "One record from the first target to the final report, in six steps. Pick your role to see your part, or walk through everything. No account needed.",
  chapters: {
    plan: { name: "Plan", promise: "Set the targets and the work once; every period starts from them." },
    collect: { name: "Collect", promise: "Field teams record once, with or without a signal." },
    track: { name: "Track", promise: "See gaps while there is still time to act." },
    see: { name: "See", promise: "The chart, map or page your board or donor asked for." },
    prove: { name: "Prove", promise: "Every number can be traced and every change is on record." },
    report: { name: "Report", promise: "Drafts that cite their sources, checked and approved by a person." },
  },
  roles: {
    director: { name: "Director", line: "The whole portfolio, where you work, and proof." },
    manager: { name: "Programme manager", line: "Plan, collect, review and report for your projects." },
    me: { name: "M&E officer", line: "Indicators, forms, values and how they are read." },
    field: { name: "Field officer", line: "Record on a phone, offline, and see what is yours." },
    grants: { name: "Grants officer", line: "Donor templates, reports and what is due." },
  },
  ui: {
    allRoles: "Everything", rolePrompt: "Show me the parts for", chapterNav: "Tour chapters", sceneOf: "Scene {n} of {total}",
    back: "Back", next: "Next", start: "Start free", goodToKnow: "Good to know", seeFeature: "More on this feature", tryIt: "Create a free workspace",
    phoneNote: "Shown on a phone, as a field officer sees it.", sampleNote: "A sample project with invented names and figures.",
    finalTitle: "See it on your own programme.",
    finalBody: "Start a free workspace and set up a project from your own documents, or compare DonorDesk with the tools you use now.",
    compare: "See the comparison", screenAlt: "DonorDesk screen: {title}",
  },
  scenes: {
    wizard: {
      title: "Start from the documents you already have",
      body: "Upload the proposal and logframe. DonorDesk reads them and proposes the results, indicators, places, work plan, budget lines and risks, each with the passage it came from. You accept, edit or reject; nothing is created until you launch.",
      note: "The assistant is off until an administrator turns it on, and every proposed item must quote the document or it is dropped. A value the document does not state shows as Not stated, never as zero.",
    },
    "sector-library": {
      title: "Start from good indicators, not a blank page",
      body: "A library covering 34 sectors suggests results, indicators and sector assumptions. Adopt the ones that fit; the project then owns its copy, and an update arrives as a comparison you accept field by field.",
      note: "Library entries are starting points that ship unreviewed, so have a sector specialist check them. A standard such as a Sphere figure is shown beside your target as a reference, and never replaces it.",
    },
    framework: {
      title: "One set of results, read as a results framework or a logframe",
      body: "Goals, outcomes, outputs and activities with their indicators, baselines and targets. Switch between the two readings, and name the levels in your donor's own words.",
      note: "After a version is approved, a baseline or target that a report used cannot change quietly: it needs a reason, which is kept with the version.",
    },
    "work-plan": {
      title: "Plan the work as a list, a timeline or a map",
      body: "Planned activities with leads, places and dates. Late items flag themselves, dates move by dragging, and each completed activity links back to what it delivered.",
      note: "A status moves only through the allowed steps, and moving a date after it has passed asks why. The reasons become the project's decision history.",
    },
    "record-activity": {
      title: "Record what happened in a minute",
      body: "Type or dictate what happened. DonorDesk fills in the date, the place and the people it finds in your words and works out the reporting period. It never invents a detail.",
      note: "A date no reporting period covers is never given to a neighbouring period; you are asked, with a link to create it.",
    },
    forms: {
      title: "Forms that feed your indicators",
      body: "Build questions with rules, photos and GPS, map each to an indicator, and share a public link or send it to the field team. Accepted records become draft indicator values for review.",
      note: "A published form is frozen so records keep the questions they were answered with. Close it and make a new one to change it.",
    },
    "field-app": {
      title: "A field app that works with no signal",
      body: "Download a project's forms and places once. Fill them offline, with photos, and they send by themselves when the signal returns, once each even if the connection drops mid-send.",
      note: "Offline data lives on the phone until sent and is wiped at sign-out. A record the server refuses is parked with the reason, never retried silently.",
    },
    "field-home": {
      title: "A field officer sees only what is theirs",
      body: "Home opens on this week's planned work and what is due, with the Record button one tap away. Menus a field role has no use for are not shown at all.",
      note: "What each role sees comes from one table. Hiding a button never replaces the server's own permission check.",
    },
    "entry-sheet": {
      title: "Enter a period's results like a spreadsheet",
      body: "Type or paste from Excel into one grid with last period's value and the running total beside each box. Attach proof where you type the figure, then hand in; a reviewer verifies or sends back with a reason.",
      note: "A verified value is locked and cannot be overwritten by a paste or an import. Typing never hands anything in by itself unless the project uses simple review.",
    },
    "data-center": {
      title: "Every number on one sheet",
      body: "All indicators, periods, targets and values in one table. Import, export, pivot or chart any measure, and see each value's status from draft to verified.",
      note: "A gap shows as Not measured, never as zero, and a rate is never summed or shown as a percent of target.",
    },
    "where-we-work": {
      title: "Results by place, from one list of places",
      body: "One shared list of places for the organisation. Results roll up from sites to districts to provinces, and every map has a table beside it.",
      note: "A place nobody has recorded a figure for is grey, not zero. Boundaries below province level exist only for countries with official files; elsewhere the map stops at provinces.",
    },
    "chart-studio": {
      title: "Chart Studio: 50 chart types, honest by default",
      body: "Pick an indicator and a shape, then style it with themes and options. The studio refuses charts that would mislead and says why, with a one-click fix.",
      note: "Different units never share a raw axis, a missing value is a gap not a zero, and unverified values are drawn only when you ask and are counted.",
    },
    dashboard: {
      title: "A dashboard that stays current",
      body: "Charts, key figures, maps and notes on a grid you can arrange. Open it full screen for the wall, print it, or share a link that expires.",
      note: "A share link shows figures as they stand when opened and never includes finance. Check a link in a signed-out browser before you send it.",
    },
    "dashboard-templates": {
      title: "Start from a sector template",
      body: "Choose a template for your sector, map its roles to your indicators, and get a working dashboard with a headline row. Copies are yours to change.",
      note: "A template names roles, never figures. A role you leave unmapped is left out, not drawn with an invented value.",
    },
    portfolio: {
      title: "Every project at a glance",
      body: "Delivery, problems and risks, and the next report for each live project, most pressing first, for the projects you can see.",
      note: "Delivery health comes from late work and overdue values; it is not a combined score, and counted-elsewhere indicators are never added twice.",
    },
    evidence: {
      title: "Evidence linked to the figure it proves",
      body: "Upload photos, receipts and documents against an activity or an indicator value. Each file shows the report statements that cite it, and confidentiality levels decide who can open it.",
      note: "A file counts as proof only once it is attached. Restricted files stay closed to roles without the permission, in lists and downloads alike.",
    },
    team: {
      title: "The right people, the right access",
      body: "Invite colleagues, partners and viewers per project. Roles decide who can write, review, approve and export, and a second approver can be required. Every change is written to an append-only audit log.",
      note: "Outside partners reach only the projects and routes you name. Two-step sign-in can be required of the whole organisation. DonorDesk does not claim an external security certification.",
    },
    "donor-template": {
      title: "Teach it your donor's report once",
      body: "Upload the donor's template. DonorDesk extracts the sections, questions, tables and word limits for you to review and approve; that becomes the skeleton of every report.",
      note: "Extraction is checked against the document and flagged where it is unsure. You approve it before anything is drafted.",
    },
    "report-editor": {
      title: "A draft written from your record, then checked claim by claim",
      body: "Generate a first draft from verified results, activities and evidence: tables and charts are built from the data and the writer only writes prose around them. Then edit, see the source of each statement, resolve the claims that need a decision and leave out what does not apply.",
      note: "A number that is not in your inputs is rejected, and a section that cannot be written safely gets the plain version with a reason. A person approves; the author cannot approve alone when a second approver is required. Any later change returns the report to review.",
    },
    export: {
      title: "Export for review or for the donor",
      body: "Download an internal copy of any draft at any time, watermarked. A donor submission is sealed only after the report is approved and its checks are clear.",
      note: "An approved report is exported against the framework it was approved against, so later edits to targets do not rewrite it.",
    },
    "closing-report": {
      title: "Close the project with confidence",
      body: "A step-by-step plan for the final report: what is missing, what is ready and who still needs to sign off.",
      note: "A final report closes the cadence of periods; the plan shows only steps that apply to your project.",
    },
    ask: {
      title: "Ask your own records",
      body: "Ask a question in plain words and get an answer built only from your indicator values, accepted activities and files you may open, with the source after each sentence.",
      note: "Off until an administrator turns it on. Sentences that cannot be tied to a source or a figure in it are dropped, so an answer can be incomplete but not invented. Finance is never read.",
    },
  },
};
