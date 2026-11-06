/**
 * "Files we will need" for a planned activity: the kinds of file that should prove it (an attendance sheet, a photo). They are
 * suggested from the activity's own words and the person only unticks; they never block anything. Coverage says what is still
 * missing, so a reviewer can be told in one line and can ask for it.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { EVIDENCE_TYPES, type EvidenceType } from "../evidence/evidence-file.js";

export const MAX_REQUIRED_FILES = 5;

/** First match adds its types; the order here is the order suggested. "Other" is never a requirement: it names nothing. */
const SUGGESTIONS: ReadonlyArray<readonly [RegExp, ReadonlyArray<EvidenceType>]> = [
  [/\b(train(ing|ed)?|workshop|session|course|orientation|awareness|sensiti[sz]ation)\b/i, ["ATTENDANCE_SHEET", "PHOTO"]],
  [/\b(meeting|consultation|forum|committee|dialogue)\b/i, ["ATTENDANCE_SHEET", "MEETING_MINUTES"]],
  [/\b(distribut(e|ion|ed)|dispatch|handover|delivery of|cash transfer|voucher)\b/i, ["DISTRIBUTION_LIST", "PHOTO"]],
  [/\b(outreach|clinic|vaccinat(e|ion)|immuni[sz]ation|screening|campaign)\b/i, ["ATTENDANCE_SHEET", "PHOTO"]],
  [/\b(monitor(ing)?|supervis(e|ion)|mentor(ing)?|follow[- ]?up|field visit|site visit|inspection)\b/i, ["FIELD_VISIT_REPORT"]],
  [/\b(survey|assessment|baseline|endline|data collection)\b/i, ["KOBO_ODK_EXPORT"]],
  [/\b(procure(ment)?|tender|purchase|supplier|quotation|construct(ion)?|rehabilit(ate|ation)|install(ation)?)\b/i, ["PROCUREMENT_DOCUMENT", "PHOTO"]],
  [/\b(case stud(y|ies)|success stor(y|ies)|testimon(y|ial))\b/i, ["CASE_STUDY"]],
  [/\b(registration|enrol(l)?ment|beneficiar(y|ies) list|selection)\b/i, ["BENEFICIARY_LIST"]],
];

/** What the activity's words suggest (title, notes, the logframe activity's title), at most `MAX_REQUIRED_FILES`, no repeats. */
export function suggestRequiredFiles(...texts: ReadonlyArray<string | undefined | null>): EvidenceType[] {
  const text = texts.filter(Boolean).join(" ");
  const out: EvidenceType[] = [];
  for (const [pattern, types] of SUGGESTIONS) {
    if (!pattern.test(text)) continue;
    for (const t of types) if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, MAX_REQUIRED_FILES);
}

/** The list that may be stored: known types only, no repeats, no "Other", at most five. */
export function normalizeRequiredFiles(types: ReadonlyArray<string>): Result<EvidenceType[]> {
  const out: EvidenceType[] = [];
  for (const t of types) {
    if (!(EVIDENCE_TYPES as string[]).includes(t) || t === "OTHER") return err(DomainError.validation("Choose a kind of file from the list", { field: "requiredFiles" }));
    if (!out.includes(t as EvidenceType)) out.push(t as EvidenceType);
  }
  if (out.length > MAX_REQUIRED_FILES) return err(DomainError.validation(`Ask for at most ${MAX_REQUIRED_FILES} kinds of file`, { field: "requiredFiles" }));
  return ok(out);
}

export interface FileCoverage {
  required: EvidenceType[];
  /** The required kinds that have a file. */
  covered: EvidenceType[];
  stillNeeded: EvidenceType[];
}

export function evidenceCoverage(required: ReadonlyArray<EvidenceType>, provided: Iterable<string>): FileCoverage {
  const have = new Set(provided);
  return { required: [...required], covered: required.filter((t) => have.has(t)), stillNeeded: required.filter((t) => !have.has(t)) };
}
