import type { WikiCategory } from "./WikiLayout";

const GettingStartedIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

const HowToIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
  </svg>
);

const TroubleshootingIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
  </svg>
);

const AdvancedIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.165-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const BillingIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

const ReportWritingIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

export const WIKI_CATEGORIES: WikiCategory[] = [
  {
    name: "Getting Started",
    slug: "getting-started",
    icon: <GettingStartedIcon />,
    description: "Everything you need to go from zero to your first donor report.",
    accentColor: "brand",
    articles: [
      { title: "Getting Started Overview", description: "Your complete first-time guide to DonorDesk.", href: "/support/getting-started" },
      { title: "What is DonorDesk?", description: "What DonorDesk is, who it's for, and how it helps.", href: "/support/getting-started/what-is-donordesk" },
      { title: "Key Concepts and Terminology", description: "Understand logframes, indicators, evidence, and more.", href: "/support/getting-started/key-concepts" },
      { title: "Understanding Projects", description: "What a project is and how to structure one.", href: "/support/getting-started/understanding-projects" },
      { title: "Understanding Logframes", description: "Goal, outcome, output, activity — the hierarchy explained.", href: "/support/getting-started/understanding-logframes" },
      { title: "Understanding Indicators", description: "What indicators are and how to define them.", href: "/support/getting-started/indicators-and-targets" },
      { title: "Understanding Evidence", description: "Evidence types, verification, and what counts.", href: "/support/getting-started/understanding-evidence" },
      { title: "Understanding Reporting Periods", description: "How to structure your reporting over time.", href: "/support/getting-started/understanding-reporting-periods" },
      { title: "Understanding Compliance Checklist", description: "How the live checklist keeps you on track.", href: "/support/getting-started/understanding-compliance-checklist" },
      { title: "Understanding Report Sections", description: "How DonorDesk structures a donor report.", href: "/support/getting-started/report-sections" },
      { title: "Understanding Report Statuses", description: "DRAFT, IN REVIEW, APPROVED, SUBMITTED — what they mean.", href: "/support/getting-started/report-statuses" },
      { title: "Understanding Report Readiness", description: "The readiness score and what it measures.", href: "/support/getting-started/report-readiness" },
      { title: "Understanding the Reporting Workflow", description: "The end-to-end reporting cycle from planning to submission.", href: "/support/getting-started/reporting-workflow" },
      { title: "Understanding Audit Logs", description: "What gets tracked and why it matters.", href: "/support/getting-started/understanding-audit-logs" },
      { title: "Donor Templates", description: "What a donor template is and why it matters.", href: "/support/getting-started/donor-templates" },
      { title: "Evidence Verification", description: "How verification states work.", href: "/support/getting-started/evidence-verification" },
      { title: "Logframe Hierarchy", description: "Goal → Outcome → Output → Activity explained.", href: "/support/getting-started/logframe-hierarchy" },
      { title: "Storage and File Management", description: "Local storage, Google Drive, and R2.", href: "/support/getting-started/storage-file-management" },
      { title: "AI in DonorDesk", description: "How AI assists report drafting in DonorDesk.", href: "/support/getting-started/ai-in-donordesk" },
      { title: "Data Security", description: "How DonorDesk protects your data.", href: "/support/getting-started/data-security" },
      { title: "User Roles and Permissions", description: "Owner, Admin, Manager, Member, Viewer roles.", href: "/support/getting-started/user-roles-and-permissions" },
      { title: "DonorDesk Pricing Plans", description: "Starter, Team, Growth, Enterprise — what's included.", href: "/support/getting-started/donor-desk-pricing-plans" },
    ],
  },
  {
    name: "How-To Guides",
    slug: "how-to",
    icon: <HowToIcon />,
    description: "Step-by-step instructions for every key task.",
    accentColor: "cyan",
    articles: [
      { title: "How to Log In", description: "Sign in to your DonorDesk workspace.", href: "/support/how-to/log-in" },
      { title: "How to Create an Account", description: "Create your DonorDesk account step by step.", href: "/support/how-to/create-an-account" },
      { title: "How to Change Your Password", description: "Update your account password.", href: "/support/how-to/change-your-password" },
      { title: "How to Delete Your Account", description: "Permanently delete your account and data.", href: "/support/how-to/delete-your-account" },
      { title: "How to Set Up a New Organisation", description: "Configure your workspace from scratch.", href: "/support/how-to/set-up-new-organisation" },
      { title: "How to Create a Project", description: "Build a new project in your workspace.", href: "/support/how-to/create-a-project" },
      { title: "How to Build a Logframe", description: "Structure goals, outcomes, outputs, and activities.", href: "/support/how-to/build-logframe" },
      { title: "How to Upload a Donor Template", description: "Upload and parse a funder template.", href: "/support/how-to/upload-donor-template" },
      { title: "How to Update Indicator Values", description: "Enter and update indicator results.", href: "/support/how-to/update-indicator-values" },
      { title: "How to Log Activities", description: "Record programme activities as they happen.", href: "/support/how-to/log-activities" },
      { title: "How to Upload Evidence", description: "Add documents and evidence to your project.", href: "/support/how-to/upload-evidence" },
      { title: "How to Use the Dashboard", description: "Navigate and get the most from your dashboard.", href: "/support/how-to/use-the-dashboard" },
      { title: "How to Use Tags and Filters", description: "Organise donors and donations with tags.", href: "/support/how-to/use-tags-and-filters" },
      { title: "How to Search Projects and Evidence", description: "Find records quickly with search.", href: "/support/how-to/search-projects-and-evidence" },
      { title: "How to Invite Team Members", description: "Add colleagues to your workspace.", href: "/support/how-to/invite-team-members" },
      { title: "How to Manage Team Roles and Permissions", description: "Control access with roles.", href: "/support/how-to/manage-team-roles-permissions" },
      { title: "How to Manage Billing and Subscription", description: "View plan, change tier, cancel.", href: "/support/how-to/manage-billing-subscription" },
      { title: "How to Export Donor Data", description: "Export donors and donations to CSV or Excel.", href: "/support/how-to/export-donor-data" },
      { title: "How to Export Reports", description: "Generate PDF, DOCX, XLSX, and ZIP exports.", href: "/support/how-to/export-reports" },
      { title: "How to Generate an AI Report Draft", description: "Use AI to draft donor report sections.", href: "/support/how-to/generate-ai-report-draft" },
      { title: "How to Review and Approve Reports", description: "Move reports through the approval workflow.", href: "/support/how-to/review-and-approve-reports" },
      { title: "How to Use the Audit Trail", description: "Track every change made to your data.", href: "/support/how-to/use-the-audit-trail" },
      { title: "How to Use Comments and Feedback", description: "Leave comments on report sections.", href: "/support/how-to/use-comments-feedback" },
      { title: "How to Use the Notification System", description: "Stay informed with in-app notifications.", href: "/support/how-to/use-the-notification-system" },
      { title: "How to Use Compliance Checklist", description: "Resolve checklist items before export.", href: "/support/how-to/use-compliance-checklist" },
      { title: "How to Use Bulk Actions", description: "Apply changes to multiple records at once.", href: "/support/how-to/use-bulk-actions" },
      { title: "How to Set Up Custom Fields", description: "Add custom fields to donor or donation records.", href: "/support/how-to/set-up-custom-fields" },
      { title: "How to Set Up Payment Integrations", description: "Connect Stripe, PayPal, and other providers.", href: "/support/how-to/set-up-payment-integrations" },
      { title: "How to Manage Recurring Donations", description: "Set up and manage recurring donor commitments.", href: "/support/how-to/manage-recurring-donations" },
      { title: "How to Process Refunds", description: "Issue refunds and keep audit records.", href: "/support/how-to/process-refunds" },
      { title: "How to Handle Failed Payments", description: "Retry or resolve failed payments.", href: "/support/how-to/handle-failed-payments" },
      { title: "How to Connect Google Drive", description: "Link Google Drive as primary storage.", href: "/support/how-to/connect-google-drive" },
      { title: "How to Import from Google Sheets", description: "Import indicator data from Sheets.", href: "/support/how-to/import-from-google-sheets" },
      { title: "How to Change Organisation Profile", description: "Update your organisation's details.", href: "/support/how-to/change-organisation-profile" },
      { title: "How to Archive a Project", description: "Archive completed or paused projects.", href: "/support/how-to/archive-a-project" },
      { title: "How to Set Up Automated Receipts", description: "Configure automatic donation receipts.", href: "/support/how-to/set-up-automated-receipts" },
      { title: "How to Manage Donation Tiers", description: "Set up tiered giving levels.", href: "/support/how-to/manage-donation-tiers" },
      { title: "How to Manage Currency Settings", description: "Configure multi-currency support.", href: "/support/how-to/manage-currency-settings" },
      { title: "How to Use the Activity Feed", description: "Track all actions on donor records.", href: "/support/how-to/use-the-activity-feed" },
      { title: "How to Use Search Functionality", description: "Search donors, donations, and projects.", href: "/support/how-to/use-search-functionality" },
      { title: "How to Onboard a Team Member", description: "Bring a new team member up to speed.", href: "/support/how-to/onboard-team-member" },
      { title: "How to Prepare for a Donor Visit", description: "Get ready for a donor monitoring visit.", href: "/support/how-to/prepare-for-donor-visit" },
    ],
  },
  {
    name: "Troubleshooting",
    slug: "troubleshooting",
    icon: <TroubleshootingIcon />,
    description: "Solve common problems quickly.",
    accentColor: "rose",
    articles: [
      { title: "Troubleshooting Login Issues", description: "Can't log in? Find solutions here.", href: "/support/troubleshooting/login-issues" },
      { title: "Troubleshooting Account Access", description: "Locked out, 2FA issues, account recovery.", href: "/support/troubleshooting/account-access" },
      { title: "Troubleshooting Billing Issues", description: "Payment failures, invoices, and plan changes.", href: "/support/troubleshooting/billing-issues" },
      { title: "Troubleshooting Browser Performance", description: "Slow pages, crashes, and display issues.", href: "/support/troubleshooting/browser-performance" },
      { title: "Troubleshooting Data Recovery", description: "Recover lost or deleted data.", href: "/support/troubleshooting/data-recovery" },

      { title: "Troubleshooting Project Setup", description: "Problems creating or configuring projects.", href: "/support/troubleshooting/project-setup" },
      { title: "Troubleshooting Logframe Issues", description: "Logframe errors and missing data.", href: "/support/troubleshooting/logframe-issues" },
      { title: "Troubleshooting Indicator Data", description: "Indicator value problems and missing data.", href: "/support/troubleshooting/indicator-data" },
      { title: "Troubleshooting Evidence Upload", description: "Upload failures and format issues.", href: "/support/troubleshooting/evidence-upload" },
      { title: "Troubleshooting Report Generation", description: "AI draft failures and missing content.", href: "/support/troubleshooting/report-generation" },
      { title: "Troubleshooting Export Issues", description: "PDF, DOCX, XLSX export problems.", href: "/support/troubleshooting/export-issues" },
      { title: "Troubleshooting Storage Issues", description: "Storage limits and missing files.", href: "/support/troubleshooting/storage-issues" },
      { title: "Troubleshooting Dashboard Loading", description: "Dashboard won't load or shows errors.", href: "/support/troubleshooting/dashboard-loading" },
      { title: "Troubleshooting Compliance Checklist", description: "Checklist not updating or items stuck.", href: "/support/troubleshooting/compliance-checklist" },
      { title: "Troubleshooting AI Report Generation", description: "AI not generating or returning errors.", href: "/support/troubleshooting/ai-report-generation" },
    ],
  },
  {
    name: "Advanced Features",
    slug: "advanced-features",
    icon: <AdvancedIcon />,
    description: "APIs, webhooks, automation, and integrations.",
    accentColor: "violet",
    articles: [
      { title: "Advanced Features Overview", description: "A map of everything beyond the basics.", href: "/support/advanced-features" },
      { title: "Using the API", description: "REST API access, authentication, and endpoints.", href: "/support/advanced-features/using-the-api" },
      { title: "Data Import and Export", description: "Bulk import and export across formats.", href: "/support/advanced-features/data-import-export" },
      { title: "Multiple Donors", description: "Managing projects with multiple donors.", href: "/support/advanced-features/multiple-donors" },
      { title: "AI Settings", description: "Configure AI behaviour and prompts.", href: "/support/advanced-features/ai-settings" },
      { title: "Compliance Automation", description: "Automate compliance checks and alerts.", href: "/support/advanced-features/compliance-automation" },
      { title: "Notification Settings", description: "Fine-tune notification delivery.", href: "/support/advanced-features/notification-settings" },
      { title: "Project Templates", description: "Use templates to speed up project setup.", href: "/support/advanced-features/project-templates" },
      { title: "Roles and Permissions", description: "Advanced role and permission management.", href: "/support/advanced-features/roles-and-permissions" },
      { title: "Team Management", description: "Manage large and complex teams.", href: "/support/advanced-features/team-management" },
      { title: "Imported vs. Linked Data", description: "Understand the difference between imported and linked evidence.", href: "/support/advanced-features/imported-vs-linked-data" },
      { title: "Templates", description: "Create and manage reusable templates.", href: "/support/advanced-features/templates" },
    ],
  },
  {
    name: "Account & Billing",
    slug: "account-billing",
    icon: <BillingIcon />,
    description: "Plans, invoices, payments, and cancellations.",
    accentColor: "emerald",
    articles: [
      { title: "Invoices", description: "Understanding and downloading your invoices.", href: "/support/account-billing/invoices" },
      { title: "Plans and Limits", description: "What each plan includes and its limits.", href: "/support/account-billing/plans-and-limits" },
    ],
  },
  {
    name: "Security & Privacy",
    slug: "security-privacy",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
    description: "Data protection, GDPR compliance, and security best practices.",
    accentColor: "amber",
    articles: [
      { title: "Security Best Practices", description: "How to keep your DonorDesk account secure.", href: "/support/security-privacy/security-best-practices" },
      { title: "Data Handling", description: "How DonorDesk collects, stores, and uses your data.", href: "/support/security-privacy/data-handling" },
      { title: "GDPR Compliance", description: "Your rights under GDPR and how DonorDesk complies.", href: "/support/security-privacy/gdpr-compliance" },
    ],
  },
  {
    name: "Report Writing Skills",
    slug: "report-writing-skills",
    icon: <ReportWritingIcon />,
    description: "Master the art of writing clear, credible, and compelling donor reports.",
    accentColor: "blue",
    articles: [
      { title: "Report Writing Fundamentals", description: "The anatomy of a strong donor report — structure, style, and what makes reports succeed.", href: "/support/report-writing-skills/report-writing-fundamentals" },
      { title: "Indicators & Evidence", description: "Transform raw indicator data into credible, evidence-backed narratives.", href: "/support/report-writing-skills/indicators-evidence" },
      { title: "Writing Clearly for Donors", description: "Style, tone, and structure for professional donor communications.", href: "/support/report-writing-skills/writing-clearly" },
      { title: "Structuring Your Narrative", description: "Build compelling analytical narratives with the CAO framework.", href: "/support/report-writing-skills/narrative-structure" },
      { title: "UNHCR Reporting", description: "Requirements, themes, and format for UNHCR-funded programmes.", href: "/support/report-writing-skills/unhcr-reporting" },
      { title: "DG ECHO Reporting", description: "RBM approach, logframe alignment, and DG ECHO's humanitarian principles.", href: "/support/report-writing-skills/dg-echo" },
      { title: "USAID Reporting", description: "ADS, MEL, QPR format, and USAID's cross-cutting requirements.", href: "/support/report-writing-skills/usaid-reporting" },
      { title: "Global Fund Reporting", description: "PUDR, dual track financing, and Global Fund's results framework.", href: "/support/report-writing-skills/global-fund" },
      { title: "GCF Reporting", description: "RMF, ESS compliance, and the Green Climate Fund's requirements.", href: "/support/report-writing-skills/gcf-reporting" },
      { title: "FCDO and Bilateral Donors", description: "Logframes, VfM analysis, and bilateral donor best practices.", href: "/support/report-writing-skills/fcdo-bilateral" },
      { title: "EU Grants Reporting", description: "NDICI, the 12 mandatory indicators, and EU financial rules.", href: "/support/report-writing-skills/eu-grants" },
      { title: "Gates Foundation Reporting", description: "Private foundation dynamics, milestones, and outcome storytelling.", href: "/support/report-writing-skills/gates-foundation" },
      { title: "Pre-Report Checklist", description: "Use before every submission to catch errors and ensure completeness.", href: "/support/report-writing-skills/pre-report-checklist" },
      { title: "Donor Comparison Table", description: "Quick-reference guide comparing all major donor frameworks.", href: "/support/report-writing-skills/donor-comparison" },
      { title: "Evidence Inventory Guide", description: "How to organise, assess, and maintain evidence throughout the project.", href: "/support/report-writing-skills/evidence-inventory" },
      { title: "Report Writing Glossary", description: "Definitions of all key terms used in donor reporting.", href: "/support/report-writing-skills/glossary" },
    ],
  },
];

export const MEMORYBANK_BASE = "/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/memorybank/docs/support";
