/**
 * Phase 32 — the Studio's plain-language labels for codes: design purpose, review status, check
 * severity, publish formats. Scanned by the copy lint: no raw code may appear in a label.
 */
import type { DesignStatus, InfographicProfile } from "@donordesk/domain/contexts/infographics/index.js";

export const PROFILE_INFO: Readonly<Record<InfographicProfile, { label: string; description: string }>> = {
  SNAPSHOT: { label: "Snapshot", description: "One story for the public or partners. Short, specific and checked for clarity." },
  DONOR_REPORT: { label: "Donor report", description: "Results for a funder. Every figure sourced; needs approval before it is published." },
  SOCIAL: { label: "Social card", description: "A short card for a feed or a story. One number, one sentence." },
  INTERNAL: { label: "Internal", description: "For your own team. The design check only advises." },
};

export const STATUS_INFO: Readonly<Record<DesignStatus, { label: string; tone: "neutral" | "warning" | "success" }>> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  IN_REVIEW: { label: "In review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
};

export const SEVERITY_INFO = {
  BLOCKER: { label: "Fix before publishing", tone: "danger" },
  WARN: { label: "Worth fixing", tone: "warning" },
  TIP: { label: "Tip", tone: "neutral" },
} as const;

export const EXPORT_INFO = [
  { format: "PNG", label: "Image (PNG)", description: "A picture to post or paste. Choose the sharpness." },
  { format: "PDF", label: "Document (PDF)", description: "Print-ready, with text you can select and search." },
  { format: "PPTX", label: "Slides (PowerPoint)", description: "One slide per page, with the sources in the notes." },
  { format: "SVG", label: "Vector (SVG)", description: "The first page as a scalable drawing." },
  { format: "PACK", label: "Pack for communications (ZIP)", description: "Every page as PNG, the PDF, SVG, a description, a caption and the sources." },
] as const;

export const SCALE_INFO = [
  { value: 1, label: "Standard" },
  { value: 2, label: "Sharp (recommended)" },
  { value: 3, label: "Print" },
] as const;

export const VARIANT_INFO = [
  { by: "LOCATION", label: "One for each location" },
  { by: "PERIOD", label: "One for each reporting period" },
  { by: "LATEST_PERIOD", label: "A copy up to the latest period" },
] as const;

export const MAP_METRIC_INFO = [
  { value: "NONE", label: "Pins only" },
  { value: "REACH", label: "Shade areas by people reached" },
  { value: "ACTIVITIES_DONE", label: "Shade areas by activities done" },
  { value: "ACTIVITIES_PLANNED", label: "Shade areas by activities planned" },
] as const;

export const NUMBER_SOURCE_INFO: ReadonlyArray<{ value: string; label: string; scope?: "PORTFOLIO" }> = [
  { value: "REACH_UNIQUE", label: "People reached (unique)" },
  { value: "REACH_REGISTERED", label: "People registered" },
  { value: "ACTIVITIES_DONE", label: "Activities completed" },
  { value: "ACTIVITIES_PLANNED", label: "Activities planned" },
  { value: "INDICATOR", label: "An indicator's latest value" },
  { value: "FINANCE_BUDGET", label: "Budget (verified finance)" },
  { value: "FINANCE_EXPENDITURE", label: "Spending (verified finance)" },
  { value: "FINANCE_BALANCE", label: "Balance (verified finance)" },
  { value: "PORTFOLIO_PROJECTS", label: "Number of projects", scope: "PORTFOLIO" },
  { value: "PORTFOLIO_COUNTRIES", label: "Number of countries", scope: "PORTFOLIO" },
  { value: "PORTFOLIO_OFF_TRACK", label: "Projects that are behind", scope: "PORTFOLIO" },
  { value: "PORTFOLIO_AT_RISK", label: "Projects needing attention", scope: "PORTFOLIO" },
  { value: "PORTFOLIO_OPEN_RISKS", label: "Open problems and risks", scope: "PORTFOLIO" },
  { value: "PORTFOLIO_REPORTS_OVERDUE", label: "Reports overdue", scope: "PORTFOLIO" },
  { value: "MANUAL", label: "A figure I type (with its source)" },
];

export const ROUNDING_INFO = [
  { value: "NONE", label: "Exact" },
  { value: "HUNDREDS", label: "To the nearest hundred" },
  { value: "THOUSANDS", label: "To the nearest thousand" },
] as const;
