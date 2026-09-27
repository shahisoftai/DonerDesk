import { DomainError } from "../../core/domain-error.js";
import type { TemplateSourceReference } from "./template-section.js";
import { REPORTING_FREQUENCIES, type ReportingFrequency } from "../projects/project.js";

export type ComplianceSeverity = "INFO" | "WARN" | "BLOCK";
export const COMPLIANCE_SEVERITIES: readonly ComplianceSeverity[] = ["INFO", "WARN", "BLOCK"];

export interface TemplateAnnex {
  id: string;
  name: string;
  required: boolean;
  description?: string;
  source?: TemplateSourceReference;
}

export interface IndicatorRequirement {
  id: string;
  text: string;
  disaggregation: string[];
  source?: TemplateSourceReference;
}

export interface ComplianceRequirement {
  id: string;
  text: string;
  severity: ComplianceSeverity;
  source?: TemplateSourceReference;
}

export interface SubmissionRequirements {
  instructions: string[];
  /** The donor's deadline rule as written ("within 30 days of period end"). */
  deadlineRule?: string;
  /** Days after period end, when the rule is expressible that way. */
  deadlineOffsetDays?: number;
  channel?: string;
  format?: string;
}

export interface FormattingRequirements {
  rules: string[];
  maxPages?: number;
  font?: string;
}

/** Whole-report requirements extracted from (or authored for) a donor template. */
export interface TemplateRequirements {
  reportTitle?: string;
  reportingFrequency?: ReportingFrequency;
  submission: SubmissionRequirements;
  formatting: FormattingRequirements;
  annexes: TemplateAnnex[];
  indicatorRequirements: IndicatorRequirement[];
  compliance: ComplianceRequirement[];
  /** Report-wide guidance for the AI writer (audience, tone, do/don't). */
  generalInstructions: string[];
}

type WithOptionalId<T extends { id: string }> = Omit<T, "id"> & { id?: string };

export interface TemplateRequirementsInput {
  reportTitle?: string;
  reportingFrequency?: ReportingFrequency;
  submission?: Partial<SubmissionRequirements>;
  formatting?: Partial<FormattingRequirements>;
  annexes?: Array<WithOptionalId<TemplateAnnex> | string>;
  indicatorRequirements?: Array<Omit<WithOptionalId<IndicatorRequirement>, "disaggregation"> & { disaggregation?: string[] }>;
  compliance?: Array<Omit<WithOptionalId<ComplianceRequirement>, "severity"> & { severity?: ComplianceSeverity }>;
  generalInstructions?: string[];
}

function text(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function list(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values ?? []) {
    const t = typeof v === "string" ? v.trim() : "";
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

function positiveInt(value: number | undefined, label: string, allowZero = false): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw DomainError.validation(`${label} must be a ${allowZero ? "non-negative" : "positive"} integer`);
  }
  return value;
}

function source(value: TemplateSourceReference | undefined): TemplateSourceReference | undefined {
  if (!value?.excerpt?.trim()) return undefined;
  return { ...value, excerpt: value.excerpt.trim() };
}

export function emptyTemplateRequirements(): TemplateRequirements {
  return { submission: { instructions: [] }, formatting: { rules: [] }, annexes: [], indicatorRequirements: [], compliance: [], generalInstructions: [] };
}

export function createTemplateRequirements(input: TemplateRequirementsInput = {}): TemplateRequirements {
  if (input.reportingFrequency !== undefined && !REPORTING_FREQUENCIES.includes(input.reportingFrequency)) {
    throw DomainError.validation(`Unknown reporting frequency: ${String(input.reportingFrequency)}`);
  }
  const annexSeen = new Set<string>();
  const annexes: TemplateAnnex[] = [];
  for (const a of input.annexes ?? []) {
    const raw = typeof a === "string" ? { name: a, required: true } : a;
    const name = raw.name?.trim();
    if (!name || annexSeen.has(name.toLowerCase())) continue;
    annexSeen.add(name.toLowerCase());
    annexes.push({
      id: ("id" in raw && raw.id) || crypto.randomUUID(),
      name,
      required: raw.required ?? true,
      ...(text(("description" in raw ? raw.description : undefined)) ? { description: text(raw.description) } : {}),
      ...(source("source" in raw ? raw.source : undefined) ? { source: source(raw.source) } : {}),
    });
  }
  const indicatorRequirements = (input.indicatorRequirements ?? [])
    .filter((r) => r.text?.trim())
    .map((r) => ({ id: r.id ?? crypto.randomUUID(), text: r.text.trim(), disaggregation: list(r.disaggregation), ...(source(r.source) ? { source: source(r.source) } : {}) }));
  const compliance = (input.compliance ?? [])
    .filter((c) => c.text?.trim())
    .map((c) => {
      const severity = c.severity ?? "WARN";
      if (!COMPLIANCE_SEVERITIES.includes(severity)) throw DomainError.validation(`Unknown compliance severity: ${String(severity)}`);
      return { id: c.id ?? crypto.randomUUID(), text: c.text.trim(), severity, ...(source(c.source) ? { source: source(c.source) } : {}) };
    });
  return {
    reportTitle: text(input.reportTitle),
    reportingFrequency: input.reportingFrequency,
    submission: {
      instructions: list(input.submission?.instructions),
      deadlineRule: text(input.submission?.deadlineRule),
      deadlineOffsetDays: positiveInt(input.submission?.deadlineOffsetDays, "Deadline offset days", true),
      channel: text(input.submission?.channel),
      format: text(input.submission?.format),
    },
    formatting: {
      rules: list(input.formatting?.rules),
      maxPages: positiveInt(input.formatting?.maxPages, "Maximum pages"),
      font: text(input.formatting?.font),
    },
    annexes,
    indicatorRequirements,
    compliance,
    generalInstructions: list(input.generalInstructions),
  };
}

/** Tolerant parse of persisted `requirementsJson`; falls back to legacy annex names. */
export function parsePersistedRequirements(raw: unknown, legacyAnnexes: readonly string[] = []): TemplateRequirements {
  const base = raw && typeof raw === "object" ? (raw as TemplateRequirementsInput) : {};
  try {
    const parsed = createTemplateRequirements(base);
    if (parsed.annexes.length === 0 && legacyAnnexes.length > 0) {
      return { ...parsed, annexes: createTemplateRequirements({ annexes: [...legacyAnnexes] }).annexes };
    }
    return parsed;
  } catch {
    return createTemplateRequirements({ annexes: [...legacyAnnexes] });
  }
}
