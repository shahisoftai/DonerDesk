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
];
