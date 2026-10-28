// Shared product copy for the home page and /features. Every claim here is
// listed as LIVE (or states its LIVE-LIMIT) in memorybank/docs/marketing/02-feature-inventory.md.
// Change the copy there first, then here.

export interface ModuleCard {
  icon: string;
  title: string;
  tag: string;
  description: string;
  href: string;
}

// Home page, section "Run the programme".
export const RUN_MODULES: ModuleCard[] = [
  {
    icon: "📊",
    title: "Logframe and indicators",
    tag: "Plan once, reuse everywhere",
    description:
      "Model goals, outcomes, outputs and activities, with indicators, baselines and targets. Import an existing logframe from Excel, CSV or Google Sheets.",
    href: "/features#logframe",
  },
  {
    icon: "📝",
    title: "Activity capture",
    tag: "Recorded as it happens",
    description:
      "Field staff record what happened: date, place, participants and a narrative, typed or dictated. The reporting period is worked out from the date.",
    href: "/features#activities",
  },
  {
    icon: "🗂️",
    title: "Data Center",
    tag: "One sheet, every period",
    description:
      "Every indicator value across every reporting period in one sheet. Download it, change it, and import it with a preview before anything changes.",
    href: "/features#data-center",
  },
  {
    icon: "🧾",
    title: "Evidence library",
    tag: "Audit-ready by default",
    description:
      "Keep documents and photos in your own Google Drive or in managed storage. Link files to activities and indicators, verify them, and export evidence packs.",
    href: "/features#evidence",
  },
  {
    icon: "👥",
    title: "Team and roles",
    tag: "Seven roles, one project",
    description:
      "Admin, Project Manager, M&E, Grants, Field, Compliance and Viewer roles. Viewers give board members and auditors read access without a full seat.",
    href: "/features#team",
  },
  {
    icon: "🧭",
    title: "My Work",
    tag: "Your queue across projects",
    description:
      "One list of what needs you: reports to review, checklist items, evidence to verify and activities to accept, across every project you are on.",
    href: "/features#team",
  },
];

// Home page, section "Report from the record".
export const REPORT_MODULES: ModuleCard[] = [
  {
    icon: "🧩",
    title: "Donor templates",
    tag: "Save weeks of formatting",
    description:
      "Upload the donor's template. DonorDesk extracts the sections, instructions, required tables and page limits. You review and approve them before any draft uses them.",
    href: "/features#templates",
  },
  {
    icon: "✨",
    title: "Sourced AI drafting",
    tag: "AI as assistant, not author",
    description:
      "Drafts follow the approved template and cite the activity, indicator value or evidence behind each statement. A figure that is not in your inputs is rejected.",
    href: "/features#drafting",
  },
  {
    icon: "🛡️",
    title: "Checks before submission",
    tag: "Gaps found early",
    description:
      "A live compliance checklist and readiness score list each blocker and the action that closes it. A claim check compares statements with your evidence and records.",
    href: "/features#compliance",
  },
  {
    icon: "📦",
    title: "Approval and exports",
    tag: "Human approval before release",
    description:
      "Second-approver rules, a sealed submission snapshot, and exports to Word, PDF, Excel and ZIP. A watermarked internal copy is available for review.",
    href: "/features#approval",
  },
];

export interface FeatureDetail {
  id: string;
  title: string;
  summary: string;
  inPractice: string[];
  who: string;
  goodToKnow: string;
  supportHref: string;
}

export interface FeatureGroup {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  features: FeatureDetail[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "run",
    eyebrow: "Run the programme",
    title: "The working record, kept as the work happens",
    intro:
      "The logframe, activities, data and team are the system the report comes from. Each one is useful on its own, long before a donor asks for a report.",
    features: [
      {
        id: "logframe",
        title: "Logframe and indicators",
        summary:
          "Goals, outcomes, outputs and activities with the indicators that measure them. Baselines, targets, frequency and aggregation are set once.",
        inPractice: [
          "Import an existing logframe from Excel, CSV, text or Google Sheets; parents and codes are resolved for you.",
          "Enter each indicator value once per reporting period, with the previous period's value suggested.",
          "Archive an indicator instead of deleting it once it has values, so history stays intact.",
        ],
        who: "M&E Officer, Project Manager",
        goodToKnow:
          "An indicator that an approved report used cannot be moved or removed without a reason; this protects the report's history.",
        supportHref: "/support/how-to/build-logframe",
      },
      {
        id: "activities",
        title: "Activity capture",
        summary:
          "A record of what happened, when, where, and with whom, entered by the person who did the work.",
        inPractice: [
          "Record the date, place, participants (with breakdowns) and a narrative. A record can cover a date span.",
          "Dictate the narrative with the microphone button; the form fills in date, place and people only from what the words state.",
          "A finished record is kept on the device and sent when the connection returns.",
          "Managers accept, send back or reject records, one at a time or in bulk.",
        ],
        who: "Field Officer, Project Manager",
        goodToKnow:
          "Dictation uses your browser's speech recognition (Chrome, Edge or Safari). Offline use means queued saving only: the app itself needs a connection to open.",
        supportHref: "/support/how-to/log-activities",
      },
      {
        id: "data-center",
        title: "Data Center",
        summary:
          "Every indicator value across every reporting period, in one sheet, with the charts drawn from it.",
        inPractice: [
          "See all periods side by side, by period or as a list.",
          "Download the sheet to Excel or CSV, change the values, and import it back.",
          "The import shows every change before it applies. A problem in any row blocks the whole import, and an empty cell never clears a stored value.",
          "Draw charts from the data; a chart added to a report is a snapshot that you update when you choose.",
        ],
        who: "M&E Officer, Grants Officer",
        goodToKnow:
          "Finance figures appear only when finance mode is switched on for the project. A missing value is left blank, never shown as zero.",
        supportHref: "/support/how-to/use-the-data-center",
      },
      {
        id: "evidence",
        title: "Evidence library",
        summary:
          "Documents, photos and records, linked to the activities and indicators they prove.",
        inPractice: [
          "Keep files in your own Google Drive (linked files do not count toward storage), or upload them to managed storage.",
          "The text of each file is read so drafts can cite it, and the cited text is fingerprinted so a later change to the source can be detected.",
          "Link a file to an activity or an indicator value, and mark it verified.",
          "Export an evidence pack as a ZIP with a README that names any file that could not be included.",
        ],
        who: "Field Officer, Compliance Officer",
        goodToKnow:
          "Scanned PDFs need readable text to support a draft. Managed storage is limited by plan (Starter 1 GB, Team 25 GB, Growth 100 GB).",
        supportHref: "/support/how-to/upload-evidence",
      },
      {
        id: "team",
        title: "Team and roles",
        summary:
          "Seven roles, so each person sees and changes only what their job needs.",
        inPractice: [
          "Admin, Project Manager, M&E Officer, Grants Officer, Field Officer, Compliance Officer and Viewer.",
          "Invite people by email. Invited and suspended members count toward your seats.",
          "Viewers can browse and export but cannot edit, approve or use AI credits.",
          "My Work gives each person one queue across all their projects.",
        ],
        who: "Admin, Project Manager",
        goodToKnow:
          "Seats are limited by plan: Starter 1 full seat, Team 5, Growth 15. Viewers are separate. Enterprise SSO (OIDC) and SCIM provisioning are set up with support.",
        supportHref: "/support/getting-started/user-roles-and-permissions",
      },
    ],
  },
  {
    id: "plan",
    eyebrow: "Plan the work",
    title: "Plan it, assign it, and see what is late",
    intro:
      "Planned work sits beside the logframe and the records of what was done, so the plan and the results never disagree about what is late. Planning is optional: a project without a plan works as it always did.",
    features: [
      {
        id: "workplan",
        title: "Work plan and Timeline",
        summary:
          "Plan activities ahead with dates and a lead, repeat them, and see them on a list, a Timeline, a calendar and a map.",
        inPractice: [
          "Start from your logframe: DonorDesk proposes dates once, you adjust them, or import a plan from a spreadsheet (a bad row blocks the import and is named).",
          "On the Timeline, drag a bar or use the arrow keys to move dates; nothing is saved until you confirm, and a reason is asked when a report already covers the dates.",
          "Every change is a dated revision, so the reasons become the project's decision history.",
          "Finish an activity in one step and link the entry you made afterwards to the activity it delivers.",
        ],
        who: "Project Manager, M&E Officer, activity leads",
        goodToKnow:
          "On time, Late, Done and Cancelled are worked out from the dates and the linked records, never typed in. An Admin can hide planning for a project; the data is kept.",
        supportHref: "/support/how-to/plan-your-activities",
      },
      {
        id: "my-work",
        title: "My Work and My week",
        summary:
          "One queue of what you have to do, across every project, and a week view for field staff.",
        inPractice: [
          "Reports to review, checklist items, evidence to verify, activities to accept, values that are late and risks to review, in one list.",
          "Ask one colleague for one thing by one day; the request closes when the work is done.",
          "Field officers open on My week, and can change a status offline.",
          "One daily summary email per person, and one escalation for something a week late. You choose how much email you get.",
        ],
        who: "Everyone",
        goodToKnow:
          "The in-app note is always written; the email setting only controls the email.",
        supportHref: "/support/how-to/ask-for-work-and-use-my-work",
      },
      {
        id: "risks",
        title: "Problems, risks and changes of plan",
        summary:
          "A short list of what could go wrong, with an owner and a review date, and a dated record of what changed.",
        inPractice: [
          "Four fields: kind, title, seriousness, action. Closing a risk records how it ended.",
          "Record a change of plan and what it did to the results; the claim checker can read it.",
          "Comment where the work is, and see which files an activity will need.",
        ],
        who: "Project Manager, anyone raising a risk",
        goodToKnow:
          "Risks are internal. They never reach a report writer.",
        supportHref: "/support/how-to/record-problems-and-risks",
      },
      {
        id: "maps",
        title: "Maps of where you work",
        summary:
          "See planned work as pins coloured by status, and show where you work on the project Overview.",
        inPractice: [
          "Free-text locations are matched against a bundled gazetteer; a place it does not know is listed as unplaced, never guessed.",
          "Pin a place by hand, or upload your own boundaries as the base map.",
          "Nothing is sent to a map service: all geography is bundled.",
        ],
        who: "Project Manager, M&E Officer",
        goodToKnow:
          "Pin colour reuses the delivery status. There is no new score.",
        supportHref: "/support/how-to/see-your-work-on-a-map",
      },
    ],
  },
  {
    id: "collect",
    eyebrow: "Collect the data",
    title: "Collect it in the field, with or without a signal",
    intro:
      "Forms, a field app, and connectors bring answers in as records that a person reviews before any figure changes.",
    features: [
      {
        id: "forms",
        title: "Collection forms and records",
        summary:
          "Build a form, share it with members or by link, review what comes in, and turn accepted records into indicator totals.",
        inPractice: [
          "Rules show or hide questions; the same rules run on the phone and on the server.",
          "Accepted records are counted or summed into the period their date falls in, as drafts, and a record that fits no period is listed apart.",
          "Photo and document questions, import from a sheet, and a place question that is read against your places list.",
          "A published form is frozen, so every record keeps the questions it was answered with.",
        ],
        who: "Project team, M&E Officer",
        goodToKnow:
          "Public links store only a hash, expire, and can be revoked.",
        supportHref: "/support/how-to/collect-answers-with-a-form",
      },
      {
        id: "field-app",
        title: "Field app and offline use",
        summary:
          "Download a project once, fill forms and take photos with no connection, and send when you are back online.",
        inPractice: [
          "Only the open forms' questions and your places list are kept on the phone, and they are wiped on sign-out.",
          "Each record is sent once, even if the connection drops mid-send.",
          "Finished activities and status changes are queued the same way.",
        ],
        who: "Field staff",
        goodToKnow:
          "Open /field once while online so the phone keeps it. The rest of the app still needs a connection to open.",
        supportHref: "/support/how-to/use-the-field-app-offline",
      },
      {
        id: "connectors",
        title: "KoboToolbox and SurveyCTO",
        summary:
          "Bring submissions from a form you already run into a collection form, to be reviewed like any record.",
        inPractice: [
          "Fields are matched by name and checked with the form's own rules.",
          "Pulling the same submission again stores it once; a refused row stops the sync and is named.",
          "The access key is encrypted and never shown again.",
        ],
        who: "Project Manager",
        goodToKnow:
          "Photos and repeat groups are not brought in yet.",
        supportHref: "/support/how-to/bring-in-kobotoolbox-or-surveycto-submissions",
      },
      {
        id: "places",
        title: "Places and results by place",
        summary:
          "Keep a list of places (country down to site) and see results rolled up by place.",
        inPractice: [
          "Additive indicators sum up the tree; a rate is shown where it was recorded and never combined.",
          "A typed location that matches no place is listed as to confirm, never dropped.",
          "Break any indicator down by location.",
        ],
        who: "M&E Officer",
        goodToKnow:
          "Stored text is not rewritten: places are matched when you read.",
        supportHref: "/support/how-to/use-the-data-center",
      },
    ],
  },
  {
    id: "report",
    eyebrow: "Report from the record",
    title: "The donor report, produced from the work you recorded",
    intro:
      "Each section is drafted from the record, checked against it, and approved by a person before anything is released.",
    features: [
      {
        id: "templates",
        title: "Donor templates",
        summary:
          "The donor's required structure, loaded once and reused across the grants that share it.",
        inPractice: [
          "Upload Word, PDF, text, Markdown, Excel or CSV.",
          "DonorDesk extracts the sections, their instructions, mandatory questions, evidence needed, required tables and page limits.",
          "Review and approve the extracted structure. Every edit is kept as a version.",
        ],
        who: "Grants Officer, M&E Officer",
        goodToKnow:
          "Uploading or approving a template never changes which template a report type uses by default.",
        supportHref: "/support/how-to/upload-donor-template",
      },
      {
        id: "drafting",
        title: "Sourced AI drafting",
        summary:
          "Drafts for each section, written from your activities, indicator values, evidence and story inputs.",
        inPractice: [
          "Each statement shows where it came from.",
          "Tables, charts and comparisons are built from verified data. The AI writes only the prose.",
          "A figure in the text that is not in your inputs is rejected and regenerated. If it still fails, the section falls back to plain text and says why.",
          "Add the context numbers cannot give: achievements, challenges, variances, lessons.",
        ],
        who: "M&E Officer, Project Manager",
        goodToKnow:
          "Successful drafts use plan credits (Starter 5 a month, Team 20, Growth 100), and top-up packs are available on Team and Growth. Growth and Enterprise can connect their own AI provider.",
        supportHref: "/support/how-to/generate-ai-report-draft",
      },
      {
        id: "reporting",
        title: "Reporting periods and roll-ups",
        summary:
          "Monthly, quarterly, semi-annual, annual, final and custom periods, with roll-up reports for the whole project.",
        inPractice: [
          "Semi-annual, annual and final reports show life-of-project totals and percent of target.",
          "A report is compared only with reports of the same type.",
          "An approved report can be reopened for changes, with a reason, and approved again.",
        ],
        who: "Project Manager, Grants Officer",
        goodToKnow:
          "Percent of target is not shown for rate indicators, where a baseline and target comparison is more meaningful.",
        supportHref: "/support/how-to/create-a-reporting-period",
      },
      {
        id: "compliance",
        title: "Compliance checklist and readiness",
        summary:
          "Every requirement from the donor's template and the project's rules, with what is still missing.",
        inPractice: [
          "Items that data settles close on their own, such as a verified procurement document.",
          "Items that need a decision stay open until a person decides them.",
          "Readiness is shown by stage: drafting, review and submission. Each blocker says what to do next.",
          "A confidentiality check blocks submission while it is open or while a restricted source is cited.",
        ],
        who: "Compliance Officer, Grants Officer",
        goodToKnow:
          "Readiness is a guide to what remains; it does not replace a donor's own review.",
        supportHref: "/support/how-to/use-compliance-checklist",
      },
      {
        id: "editor",
        title: "Report editor",
        summary:
          "A document you edit in place, with the sources and the open questions beside it.",
        inPractice: [
          "Edit headings, lists, quotes, tables and links as in a document.",
          "Statements that need a decision are flagged with the reason.",
          "Comment on a section; the people concerned are notified.",
          "Insert a table or chart from the Data Center into a section.",
        ],
        who: "Everyone who writes or reviews a report",
        goodToKnow:
          "Changes are tracked per section, so you can see what changed and when.",
        supportHref: "/support/how-to/use-the-report-editor",
      },
      {
        id: "approval",
        title: "Review, approval and export",
        summary:
          "A report moves from draft to review to approval to submission, with people deciding each step.",
        inPractice: [
          "A project can require a second approver; the author cannot approve their own report unless the rule allows it.",
          "The submitted file is a sealed snapshot, so it cannot drift from what was approved.",
          "Export to Word, PDF, Excel (indicator tables) and ZIP (evidence packs).",
          "Export a watermarked internal copy at any stage for review.",
        ],
        who: "Project Manager, Admin, approvers",
        goodToKnow:
          "DonorDesk does not send reports to donors. You upload the approved file yourself.",
        supportHref: "/support/how-to/review-and-approve-reports",
      },
    ],
  },
  {
    id: "insight",
    eyebrow: "Understand and show it",
    title: "See the whole picture, then show it to others",
    intro:
      "Dashboards, infographics and plain-language questions all read the same record, and show a missing value as missing.",
    features: [
      {
        id: "dashboards",
        title: "Dashboards",
        summary:
          "Pin charts from your projects to a canvas, arrange them, and share by link or embed.",
        inPractice: [
          "Every figure is drawn from the data each time the dashboard is opened, so it cannot go stale.",
          "A chart from a project you cannot see says so instead of showing data.",
          "Share links expire, can be revoked, and show finance as not available.",
        ],
        who: "Anyone who can see the project",
        goodToKnow:
          "A shared link shows the data as it stands when opened, not a snapshot.",
        supportHref: "/support/how-to/make-a-dashboard",
      },
      {
        id: "infographics",
        title: "Infographic Studio",
        summary:
          "Make a one-page design from six templates and publish it as PNG, PDF or SVG.",
        inPractice: [
          "A design stores layout, never data; a block with nothing reported says Not yet reported.",
          "A Design check lists what blocks publishing, such as a figure with no source line.",
          "Published exports are immutable and can be shared by an expiring link; English, French, Spanish and Arabic.",
        ],
        who: "Project Manager, Communications",
        goodToKnow:
          "Wording suggestions come from your records. Model-written text is opt-in and labelled.",
        supportHref: "/support/how-to/make-an-infographic",
      },
      {
        id: "ask",
        title: "Ask DonorDesk",
        summary:
          "Ask a question about a project in plain words and get an answer that cites its records.",
        inPractice: [
          "Each sentence of the answer names the records it rests on, and every figure in it must appear there.",
          "If the records do not answer, it says so.",
          "Finance is never read, and evidence is read only at levels you may open.",
        ],
        who: "Anyone who can see the project",
        goodToKnow:
          "Off until an administrator turns it on. The check guarantees what is shown is grounded; it does not guarantee the answer is complete.",
        supportHref: "/support/how-to/ask-a-question-about-a-project",
      },
      {
        id: "portfolio",
        title: "Programmes, grants and the portfolio",
        summary:
          "Group projects under programmes and grants, and see every project that needs you first.",
        inPractice: [
          "No combined score: each project keeps its own delivery label.",
          "An indicator counted elsewhere is listed and never added twice.",
          "Match each donor requirement to your own indicator.",
        ],
        who: "Admin, Grants Officer",
        goodToKnow:
          "Funding placement is changed only from the funding screen.",
        supportHref: "/support/how-to/set-up-programmes-and-grants",
      },
    ],
  },
  {
    id: "connect",
    eyebrow: "Connect and trust",
    title: "Connect it to the tools you use, and trust what it holds",
    intro:
      "Open interfaces are read-only and scoped. Security controls are stated as facts the code enforces, and no certification is claimed.",
    features: [
      {
        id: "integrations",
        title: "API, webhooks and AI assistants",
        summary:
          "Read-only API keys, signed webhooks and a Model Context Protocol server.",
        inPractice: [
          "Keys are scoped to projects and data, stored as a hash, shown once, and can expire.",
          "Webhooks carry ids and statuses, never text, and switch off after repeated failures.",
          "Finance is never exposed.",
        ],
        who: "Administrator",
        goodToKnow:
          "Keys can only read. Per-key rate limits apply.",
        supportHref: "/support/how-to/connect-api-keys-webhooks-and-ai-assistants",
      },
      {
        id: "security",
        title: "Security and access",
        summary:
          "Two-step sign-in, organisation-wide requirement, outside partners, and an audit log that cannot be edited.",
        inPractice: [
          "An administrator can require two-step sign-in for everyone.",
          "Outside partners see named projects only.",
          "Row-level isolation per organisation, an append-only audit log, restricted evidence by level, and an organisation export.",
          "Approved figures are locked; correcting them is a recorded reopening.",
        ],
        who: "Admin, Compliance Officer",
        goodToKnow:
          "DonorDesk holds no external certification and says so.",
        supportHref: "/support/how-to/require-two-step-sign-in",
      },
      {
        id: "languages",
        title: "Interface languages",
        summary:
          "Use the screens in English, French, Spanish or Arabic (right to left).",
        inPractice: [
          "Choose a language once; it is kept on the device and works offline.",
          "Dates and numbers follow the language.",
        ],
        who: "Everyone",
        goodToKnow:
          "French, Spanish and Arabic translations are first drafts awaiting native review.",
        supportHref: "/support/how-to/change-the-interface-language",
      },
    ],
  },
];
