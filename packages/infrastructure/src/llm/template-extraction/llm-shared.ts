import type { DocumentBlock } from "@donordesk/application";
import { createTemplateRequirements, type ComplianceSeverity, type TemplateRequirements, type TemplateRequirementsInput } from "@donordesk/domain";
import type { SourceGrounding } from "./grounding.js";

/** Coercion helpers: LLM output is never trusted, every field is re-typed. */
export type Raw = Record<string, unknown>;
export const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
export const int = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);
export const strs = (v: unknown): string[] => arr(v).map(str).filter((x): x is string => Boolean(x));

export const FREQUENCIES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "CUSTOM"] as const;

export function parseJsonObject(text: string): Raw | undefined {
  const stripped = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return obj(JSON.parse(stripped.slice(start, end + 1)));
  } catch {
    return undefined;
  }
}

/** One block as a prompt line: `[index pN] content` (tables capped at 12 rows). */
export function renderBlock(b: DocumentBlock, i: number): string {
  const page = "page" in b && b.page ? ` p${b.page}` : "";
  switch (b.kind) {
    case "HEADING":
      return `[${i}${page}] ${"#".repeat(Math.min(6, b.level))} ${b.text}`;
    case "PARAGRAPH":
      return `[${i}${page}] ${b.emphasis ? `**${b.text}**` : b.text}`;
    case "LIST_ITEM":
      return `[${i}${page}] ${"  ".repeat(b.depth)}- ${b.text}`;
    case "TABLE":
      return `[${i}${page}] TABLE\n${b.rows.slice(0, 12).map((r) => `| ${r.join(" | ")} |`).join("\n")}${b.rows.length > 12 ? `\n(… ${b.rows.length - 12} more rows)` : ""}`;
  }
}

export function blockLength(b: DocumentBlock): number {
  return b.kind === "TABLE" ? b.rows.flat().join(" ").length : b.text.length;
}

/** The report-level part of the extraction JSON schema, shared by all LLM prompts. */
export const REQUIREMENTS_SCHEMA = `  "generalInstructions": [{"text": string, "quote": string}],
  "submission": {"instructions": [{"text": string, "quote": string}], "deadlineRule": string|null, "deadlineOffsetDays": integer|null},
  "formatting": {"rules": [{"text": string, "quote": string}], "maxPages": integer|null, "font": string|null},
  "annexes": [{"name": string, "required": boolean, "description": string|null, "quote": string}],
  "indicatorRequirements": [{"text": string, "disaggregation": [string], "quote": string}],
  "compliance": [{"text": string, "severity": "INFO"|"WARN"|"BLOCK", "quote": string}]`;

/**
 * Accumulates report-level requirements across several LLM responses, keeping
 * only items grounded in the template text. Counts kept/dropped items.
 */
export class RequirementsCollector {
  kept = 0;
  dropped = 0;
  private readonly reqs: Required<Pick<TemplateRequirementsInput, "annexes" | "indicatorRequirements" | "compliance" | "generalInstructions">> & {
    reportTitle?: string;
    reportingFrequency?: (typeof FREQUENCIES)[number];
    submission: { instructions: string[]; deadlineRule?: string; deadlineOffsetDays?: number };
    formatting: { rules: string[]; maxPages?: number; font?: string };
  } = { annexes: [], indicatorRequirements: [], compliance: [], generalInstructions: [], submission: { instructions: [] }, formatting: { rules: [] } };

  constructor(private readonly grounding: SourceGrounding) {}

  add(raw: Raw): void {
    const grounding = this.grounding;
    const reqs = this.reqs;
    const grounded = (items: unknown[], field = "text") =>
      items.map(obj).filter((i) => {
        const ok = grounding.grounded(str(i.quote), 0.8) || grounding.grounded(str(i[field]), 0.6);
        if (ok) this.kept++;
        else this.dropped++;
        return ok;
      });
    reqs.reportTitle ??= str(raw.reportTitle) && grounding.grounded(str(raw.reportTitle), 0.6) ? str(raw.reportTitle) : undefined;
    if (!reqs.reportingFrequency && FREQUENCIES.includes(raw.reportingFrequency as (typeof FREQUENCIES)[number])) {
      reqs.reportingFrequency = raw.reportingFrequency as (typeof FREQUENCIES)[number];
    }
    const sourceOf = (i: Raw) => (str(i.quote) && grounding.grounded(str(i.quote), 0.8) ? { excerpt: str(i.quote)! } : undefined);
    reqs.generalInstructions.push(...grounded(arr(raw.generalInstructions)).map((i) => str(i.text)!).filter(Boolean));
    const submission = obj(raw.submission);
    reqs.submission.instructions.push(...grounded(arr(submission.instructions)).map((i) => str(i.text)!).filter(Boolean));
    if (str(submission.deadlineRule) && grounding.grounded(str(submission.deadlineRule), 0.5)) {
      reqs.submission.deadlineRule ??= str(submission.deadlineRule);
      reqs.submission.deadlineOffsetDays ??= int(submission.deadlineOffsetDays);
    }
    const formatting = obj(raw.formatting);
    reqs.formatting.rules.push(...grounded(arr(formatting.rules)).map((i) => str(i.text)!).filter(Boolean));
    reqs.formatting.maxPages ??= int(formatting.maxPages) || undefined;
    reqs.formatting.font ??= str(formatting.font);
    reqs.annexes.push(
      ...grounded(arr(raw.annexes), "name").map((a) => ({
        name: str(a.name) ?? "",
        required: typeof a.required === "boolean" ? a.required : true,
        description: str(a.description),
        source: sourceOf(a),
      })),
    );
    reqs.indicatorRequirements.push(...grounded(arr(raw.indicatorRequirements)).map((i) => ({ text: str(i.text) ?? "", disaggregation: strs(i.disaggregation), source: sourceOf(i) })));
    reqs.compliance.push(
      ...grounded(arr(raw.compliance)).map((c) => ({
        text: str(c.text) ?? "",
        severity: (["INFO", "WARN", "BLOCK"].includes(String(c.severity)) ? c.severity : "WARN") as ComplianceSeverity,
        source: sourceOf(c),
      })),
    );
  }

  /** Sets the title/frequency when no response supplied them (e.g. from the outline pass). */
  seed(values: { reportTitle?: string; reportingFrequency?: string }): void {
    this.add({ reportTitle: values.reportTitle, reportingFrequency: values.reportingFrequency });
  }

  build(warnings: string[]): TemplateRequirements {
    try {
      return createTemplateRequirements(dedupe(this.reqs));
    } catch (error) {
      warnings.push(`Some report-level requirements were invalid and ignored: ${error instanceof Error ? error.message : String(error)}`);
      return createTemplateRequirements({ annexes: this.reqs.annexes, compliance: this.reqs.compliance });
    }
  }
}

/** Several responses (one per part of the template) can repeat the same rule. */
function dedupe<T extends object>(reqs: T): T {
  const r = reqs as unknown as {
    generalInstructions: string[];
    submission: { instructions: string[] };
    formatting: { rules: string[] };
    annexes: Array<{ name: string }>;
    indicatorRequirements: Array<{ text: string }>;
    compliance: Array<{ text: string }>;
  };
  const uniq = <X>(items: X[], key: (x: X) => string) => {
    const seen = new Set<string>();
    return items.filter((x) => {
      const k = key(x).toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  return {
    ...reqs,
    generalInstructions: uniq(r.generalInstructions, (x) => x),
    submission: { ...r.submission, instructions: uniq(r.submission.instructions, (x) => x) },
    formatting: { ...r.formatting, rules: uniq(r.formatting.rules, (x) => x) },
    annexes: uniq(r.annexes, (x) => x.name),
    indicatorRequirements: uniq(r.indicatorRequirements, (x) => x.text),
    compliance: uniq(r.compliance, (x) => x.text),
  };
}
