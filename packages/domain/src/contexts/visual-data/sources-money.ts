import type { DataSourceDef } from "./types.js";

/** Money and the portfolio around it. Amounts are in major units of one currency and are never added across currencies. */
export const MONEY_SOURCES: readonly DataSourceDef[] = [
  {
    id: "funding", label: "Funding", description: "What funders committed and what was received, by funding source and currency.",
    grain: "a funding row or a disbursement", permission: "project.view", guest: false, reader: "GetProjectFinanceHandler",
    joins: ["PROJECT", "PERIOD", "DONOR", "GRANT", "CURRENCY"],
    fields: [
      { id: "funder", label: "Funder", meaning: "The funding source.", role: "DIMENSION", type: "TEXT", joinKey: "DONOR" },
      { id: "currency", label: "Currency", meaning: "The currency of the amount.", role: "DIMENSION", type: "TEXT", joinKey: "CURRENCY" },
      { id: "obligated", label: "Obligated", meaning: "Committed by own funding sources.", role: "MEASURE", type: "AMOUNT", money: true, additive: true },
      { id: "received", label: "Received", meaning: "Approved disbursements.", role: "MEASURE", type: "AMOUNT", money: true, additive: true },
      { id: "remaining", label: "Still to receive", meaning: "Obligated less received.", role: "MEASURE", type: "AMOUNT", money: true, additive: true },
    ],
  },
  {
    id: "spending", label: "Spending", description: "Approved expenses against budget lines; drafts are not spending.",
    grain: "an approved expense", permission: "project.view", guest: false, reader: "DatasetExtrasService.budget",
    joins: ["PROJECT", "PERIOD", "DONOR", "CURRENCY", "LOGFRAME_NODE"],
    fields: [
      { id: "currency", label: "Currency", meaning: "The currency of the line.", role: "DIMENSION", type: "TEXT", joinKey: "CURRENCY" },
      { id: "category", label: "Budget category", meaning: "The cost category of the line.", role: "DIMENSION", type: "TEXT" },
      { id: "result", label: "Result served", meaning: "The result the line's activity contributes to; unlinked lines are one group.", role: "DIMENSION", type: "TEXT", joinKey: "LOGFRAME_NODE" },
      { id: "budgeted", label: "Budgeted", meaning: "The amount budgeted.", role: "MEASURE", type: "AMOUNT", money: true, additive: true },
      { id: "spent", label: "Spent", meaning: "Approved expenses to date.", role: "MEASURE", type: "AMOUNT", money: true, additive: true },
      { id: "burn_rate", label: "Burn rate", meaning: "Spending set beside the time elapsed; no projection.", role: "MEASURE", type: "RATE" },
    ],
  },
  {
    id: "projects", label: "Projects", description: "The projects the person can see, with sector, country, dates and delivery health.",
    grain: "a project", permission: "project.view", guest: false, reader: "ListProjectsHandler",
    joins: ["PROJECT", "SECTOR", "GRANT", "PLACE"],
    fields: [
      { id: "project", label: "Project", meaning: "The project.", role: "DIMENSION", type: "TEXT", joinKey: "PROJECT" },
      { id: "sector", label: "Sector", meaning: "The project's main sector.", role: "DIMENSION", type: "TEXT", joinKey: "SECTOR" },
      { id: "country", label: "Country", meaning: "Where the project works.", role: "DIMENSION", type: "PLACE", joinKey: "PLACE" },
      { id: "health_band", label: "Delivery health", meaning: "On track, needs attention or off track, from late work and overdue values.", role: "DIMENSION", type: "STATUS" },
      { id: "project_count", label: "Projects", meaning: "How many. An indicator marked counted elsewhere is never added across projects.", role: "MEASURE", type: "COUNT", additive: true },
    ],
  },
  {
    id: "programmes", label: "Programmes and grants", description: "Programmes, grants and the projects placed under them.",
    grain: "a grant", permission: "project.view", guest: false, reader: "GetPortfolioOverviewHandler",
    joins: ["PROJECT", "GRANT", "DONOR", "SECTOR"],
    fields: [
      { id: "programme", label: "Programme", meaning: "The programme.", role: "DIMENSION", type: "TEXT" },
      { id: "grant", label: "Grant", meaning: "The grant.", role: "DIMENSION", type: "TEXT", joinKey: "GRANT" },
      { id: "grant_count", label: "Grants", meaning: "How many.", role: "MEASURE", type: "COUNT", additive: true },
    ],
  },
  {
    id: "library", label: "Sector library", description: "Reference standards and indicator definitions from the sector library.",
    grain: "a library indicator", permission: "project.view", guest: true, reader: "sector-library",
    joins: ["SECTOR", "INDICATOR"],
    fields: [
      { id: "reference", label: "Reference standard", meaning: "A standard shown beside a target; never a target itself.", role: "DIMENSION", type: "TEXT" },
      { id: "library_sector", label: "Library sector", meaning: "The sector the entry belongs to.", role: "DIMENSION", type: "TEXT", joinKey: "SECTOR" },
    ],
  },
];
