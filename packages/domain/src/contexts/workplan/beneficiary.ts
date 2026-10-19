/**
 * Beneficiary records (phase 28.1-G): one row per person a project reaches, identified by a case code, never by name, phone
 * number or ID. Sex, age group and location only, with consent recorded. A repeated case code is refused. Two records that look
 * like the same person (same sex, age group, location and enrolment day) are flagged for a person to decide, never merged.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { isPlainDate, type PlainDate } from "./plain-date.js";

export const BENEFICIARY_SEX = ["FEMALE", "MALE"] as const;
export type BeneficiarySex = (typeof BENEFICIARY_SEX)[number];
export const BENEFICIARY_AGE_GROUPS = ["UNDER_5", "AGE_5_17", "AGE_18_59", "AGE_60_PLUS"] as const;
export type BeneficiaryAgeGroup = (typeof BENEFICIARY_AGE_GROUPS)[number];

export const BENEFICIARY_SEX_LABEL: Readonly<Record<BeneficiarySex, string>> = { FEMALE: "Female", MALE: "Male" };
export const BENEFICIARY_AGE_LABEL: Readonly<Record<BeneficiaryAgeGroup, string>> = {
  UNDER_5: "Under 5", AGE_5_17: "5 to 17", AGE_18_59: "18 to 59", AGE_60_PLUS: "60 and over",
};

/** A case code: letters, digits, dash, underscore or slash; 2 to 30 characters. Names and ID numbers are not accepted in form. */
export const CASE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_/]{1,29}$/;

export interface BeneficiaryInput {
  caseCode: string;
  sex: BeneficiarySex;
  ageGroup: BeneficiaryAgeGroup;
  location?: string;
  enrolledOn: string;
  consentRecorded: boolean;
}

export function checkBeneficiary(input: BeneficiaryInput): Result<{ caseCode: string; sex: BeneficiarySex; ageGroup: BeneficiaryAgeGroup; location: string; enrolledOn: PlainDate }> {
  const caseCode = input.caseCode.trim();
  if (!CASE_CODE_PATTERN.test(caseCode)) return err(DomainError.validation("Use a case code of 2 to 30 letters, digits, dashes or slashes (no names)", { field: "caseCode" }));
  if (!BENEFICIARY_SEX.includes(input.sex)) return err(DomainError.validation("Choose female or male", { field: "sex" }));
  if (!BENEFICIARY_AGE_GROUPS.includes(input.ageGroup)) return err(DomainError.validation("Choose an age group", { field: "ageGroup" }));
  if (!isPlainDate(input.enrolledOn)) return err(DomainError.validation("Choose the day they joined", { field: "enrolledOn" }));
  if (!input.consentRecorded) return err(DomainError.validation("Record consent before saving this person", { field: "consentRecorded" }));
  return ok({ caseCode, sex: input.sex, ageGroup: input.ageGroup, location: (input.location ?? "").trim(), enrolledOn: input.enrolledOn });
}

export interface BeneficiaryLike { caseCode: string; sex: string; ageGroup: string; location: string; enrolledOn: string }

/** Refuses a repeated case code; flags a probable duplicate (same sex, age group, location and day) for a person to decide. */
export function duplicateCheck(candidate: BeneficiaryLike, existing: ReadonlyArray<BeneficiaryLike>): { refused: boolean; message?: string; probable: string[] } {
  if (existing.some((e) => e.caseCode === candidate.caseCode)) {
    return { refused: true, message: `Case code ${candidate.caseCode} is already used in this project`, probable: [] };
  }
  const probable = existing
    .filter((e) => e.sex === candidate.sex && e.ageGroup === candidate.ageGroup && e.location === candidate.location && e.enrolledOn === candidate.enrolledOn)
    .map((e) => e.caseCode);
  return { refused: false, probable };
}

/** Counts by sex and age group: each person counted once, never a blank as zero. */
export function beneficiaryCounts(records: ReadonlyArray<{ sex: string; ageGroup: string }>): { total: number; bySex: Record<string, number>; byAgeGroup: Record<string, number> } {
  const bySex: Record<string, number> = {};
  const byAgeGroup: Record<string, number> = {};
  for (const r of records) {
    bySex[r.sex] = (bySex[r.sex] ?? 0) + 1;
    byAgeGroup[r.ageGroup] = (byAgeGroup[r.ageGroup] ?? 0) + 1;
  }
  return { total: records.length, bySex, byAgeGroup };
}
