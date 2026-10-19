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

export function parseSubmissions(text: string): Result<{ rows: SubmissionRow[]; problems: SubmissionProblem[] }> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return err(DomainError.validation("The file has no submissions to import"));
  const headers = splitDelimited(lines[0]!, ",").map(baseName);
  const col = (name: string) => headers.indexOf(name);
  for (const required of ["case_code", "sex", "age_group", "date", "consent"]) {
    if (col(required) < 0) return err(DomainError.validation(`The file needs a column named ${required}`, { field: required }));
  }
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
