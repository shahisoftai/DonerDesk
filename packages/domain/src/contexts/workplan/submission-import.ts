/**
 * Import of a KoboToolbox or ODK export (phase 28.1-I): one beneficiary row per submission, read by column name. Any bad
 * row blocks the whole import and names its line; a row whose case code is already in the project is named too. Nothing
 * is saved on a refusal, the same rule as the other imports.
 *
 * Expected columns (names are matched after trimming and lower-casing; the export's group prefix is removed):
 *   case_code, sex, age_group, location, date, consent
 * sex: female/male (or f/m, woman/man, girl/boy as "female"/"male"); age_group: under_5, 5_17, 18_59, 60_plus (or the labels);
 * consent: yes/no, true/false, 1/0. Other columns are ignored.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { splitDelimited } from "../../core/delimited.js";
import { checkBeneficiary, type BeneficiaryAgeGroup, type BeneficiarySex } from "./beneficiary.js";
import { isPlainDate } from "./plain-date.js";

export interface SubmissionRow {
  line: number;
  caseCode: string;
  sex: BeneficiarySex;
  ageGroup: BeneficiaryAgeGroup;
  location: string;
  enrolledOn: string;
  consentRecorded: boolean;
}

export interface SubmissionProblem { line: number; message: string }

const SEX: Record<string, BeneficiarySex> = { female: "FEMALE", f: "FEMALE", woman: "FEMALE", girl: "FEMALE", male: "MALE", m: "MALE", man: "MALE", boy: "MALE" };
const AGE: Record<string, BeneficiaryAgeGroup> = {
  under_5: "UNDER_5", "under 5": "UNDER_5", "5_17": "AGE_5_17", "5-17": "AGE_5_17", "5 to 17": "AGE_5_17",
  "18_59": "AGE_18_59", "18-59": "AGE_18_59", "18 to 59": "AGE_18_59", "60_plus": "AGE_60_PLUS", "60+": "AGE_60_PLUS", "60 and over": "AGE_60_PLUS",
};
const YES = new Set(["yes", "true", "1", "y"]);
const NO = new Set(["no", "false", "0", "n", ""]);

/** The export's group prefix ("group_intro/case_code" → "case_code"). */
const baseName = (header: string): string => (header.split("/").pop() ?? header).trim().toLowerCase().replace(/[\s-]+/g, "_");

/** The fields the import needs, and the column in the file each one is read from (the file's own header, as written). */
export const SUBMISSION_FIELDS = ["case_code", "sex", "age_group", "location", "date", "consent"] as const;
export type SubmissionField = (typeof SUBMISSION_FIELDS)[number];
export const REQUIRED_SUBMISSION_FIELDS: ReadonlyArray<SubmissionField> = ["case_code", "sex", "age_group", "date", "consent"];
export type SubmissionMapping = Partial<Record<SubmissionField, string>>;

/** The file's column headers, read the same way the parser reads them. */
export function submissionHeaders(text: string): string[] {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  return splitDelimited(first, ",").map((h) => h.trim()).filter((h) => h !== "");
}

/**
 * A starting mapping from the file's headers: each field takes the header whose normalised name matches it (case, spaces, dashes
 * and group prefixes ignored). A person checks it before importing; nothing is saved from a suggestion alone.
 */
export function suggestSubmissionMapping(headers: ReadonlyArray<string>): SubmissionMapping {
  const norm = (h: string) => baseName(h);
  const mapping: SubmissionMapping = {};
  for (const field of SUBMISSION_FIELDS) {
    const hit = headers.find((h) => norm(h) === field);
    if (hit) mapping[field] = hit;
  }
  return mapping;
}

/** Refuses a mapping that leaves a required field unset or points at a header the file does not have. */
export function checkSubmissionMapping(mapping: SubmissionMapping, headers: ReadonlyArray<string>): Result<SubmissionMapping> {
  for (const field of REQUIRED_SUBMISSION_FIELDS) {
    const header = mapping[field];
    if (!header) return err(DomainError.validation(`Choose the column for ${field.replace(/_/g, " ")}`, { field }));
    if (!headers.includes(header)) return err(DomainError.validation(`The column ${header} is not in this file`, { field }));
  }
  for (const field of SUBMISSION_FIELDS) {
    const header = mapping[field];
    if (header !== undefined && !headers.includes(header)) return err(DomainError.validation(`The column ${header} is not in this file`, { field }));
  }
  return ok(mapping);
}

export function parseSubmissions(text: string, mapping?: SubmissionMapping): Result<{ rows: SubmissionRow[]; problems: SubmissionProblem[] }> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return err(DomainError.validation("The file has no submissions to import"));
  const rawHeaders = splitDelimited(lines[0]!, ",").map((h) => h.trim()).filter((h) => h !== "");
  const headers = rawHeaders.map(baseName);
  const chosen = mapping ?? suggestSubmissionMapping(rawHeaders);
  const checked = checkSubmissionMapping(chosen, rawHeaders);
  if (!checked.ok) return checked;
  // Column positions in the file, by the field each one is mapped to.
  const at = (field: SubmissionField) => (chosen[field] !== undefined ? rawHeaders.indexOf(chosen[field]!) : -1);
  const col = (name: string) => (SUBMISSION_FIELDS.includes(name as SubmissionField) ? at(name as SubmissionField) : headers.indexOf(name));
  const rows: SubmissionRow[] = [];
  const problems: SubmissionProblem[] = [];
  lines.slice(1).forEach((raw, i) => {
    const line = i + 2;
    const cells = splitDelimited(raw, ",");
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
    const sex = SEX[get("sex").toLowerCase()];
    const ageGroup = AGE[get("age_group").toLowerCase()];
    const consent = get("consent").toLowerCase();
    if (!sex) return problems.push({ line, message: `Line ${line}: sex must be female or male` });
    if (!ageGroup) return problems.push({ line, message: `Line ${line}: age group must be under 5, 5 to 17, 18 to 59 or 60 and over` });
    if (!YES.has(consent) && !NO.has(consent)) return problems.push({ line, message: `Line ${line}: consent must be yes or no` });
    if (!isPlainDate(get("date"))) return problems.push({ line, message: `Line ${line}: the date must look like 2026-10-14` });
    const checked = checkBeneficiary({
      caseCode: get("case_code"), sex, ageGroup, location: get("location"), enrolledOn: get("date"), consentRecorded: YES.has(consent),
    });
    if (!checked.ok) return problems.push({ line, message: `Line ${line}: ${checked.error.message}` });
    rows.push({ line, caseCode: checked.value.caseCode, sex, ageGroup, location: checked.value.location, enrolledOn: checked.value.enrolledOn, consentRecorded: YES.has(consent) });
  });
  // A repeated case code inside the file is a problem for both lines.
  const seen = new Map<string, number>();
  for (const r of rows) {
    const first = seen.get(r.caseCode);
    if (first !== undefined) problems.push({ line: r.line, message: `Line ${r.line}: case code ${r.caseCode} also appears on line ${first}` });
    else seen.set(r.caseCode, r.line);
  }
  return ok({ rows, problems });
}

/**
 * Rows of a file that look like someone already on the register (same sex, age group, location and day, but a different case
 * code). They are listed for a person to look at; they are not refused and not merged. A case code already used is a clash.
 */
export function reviewRows(
  rows: ReadonlyArray<SubmissionRow>,
  existing: ReadonlyArray<{ caseCode: string; sex: string; ageGroup: string; location: string; enrolledOn: string }>,
): { clashes: Array<{ line: number; caseCode: string }>; likely: Array<{ line: number; caseCode: string; looksLike: string[] }> } {
  const taken = new Set(existing.map((e) => e.caseCode));
  const clashes: Array<{ line: number; caseCode: string }> = [];
  const likely: Array<{ line: number; caseCode: string; looksLike: string[] }> = [];
  for (const row of rows) {
    if (taken.has(row.caseCode)) { clashes.push({ line: row.line, caseCode: row.caseCode }); continue; }
    const looksLike = existing
      .filter((e) => e.sex === row.sex && e.ageGroup === row.ageGroup && e.location === row.location && e.enrolledOn === row.enrolledOn)
      .map((e) => e.caseCode);
    if (looksLike.length) likely.push({ line: row.line, caseCode: row.caseCode, looksLike });
  }
  return { clashes, likely };
}
