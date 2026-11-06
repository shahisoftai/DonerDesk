import { DomainError } from "../../core/domain-error.js";

/**
 * The funding hierarchy: a programme groups grants and projects; a grant is one award (who funds, how much, for how
 * long); a project is delivered under a grant. Before this the donor was free text on the project, so nothing could be
 * rolled up across the awards of one donor or the projects of one programme.
 */
export type FundingStatus = "ACTIVE" | "CLOSED";
export const FUNDING_STATUSES: readonly FundingStatus[] = ["ACTIVE", "CLOSED"];

export interface ProgrammeRecord {
  id: string;
  tenantId: string;
  name: string;
  code?: string | undefined;
  description?: string | undefined;
  status: FundingStatus;
  createdById: string;
  createdAt: Date;
}

export interface GrantRecord {
  id: string;
  tenantId: string;
  programmeId?: string | undefined;
  title: string;
  donorName: string;
  awardNumber?: string | undefined;
  /** Decimal string, present with `currency`. */
  amount?: string | undefined;
  currency?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  status: FundingStatus;
  createdById: string;
  createdAt: Date;
}

const text = (value: string | undefined, max: number): string | undefined => {
  const t = value?.trim();
  return t ? t.slice(0, max) : undefined;
};

export interface ProgrammeInput { name: string; code?: string; description?: string; status?: FundingStatus }
export interface CleanProgramme { name: string; code?: string | undefined; description?: string | undefined; status: FundingStatus }

export function cleanProgramme(input: ProgrammeInput): CleanProgramme {
  const name = text(input.name, 160);
  if (!name || name.length < 2) throw DomainError.validation("Give the programme a name.");
  if (input.status !== undefined && !FUNDING_STATUSES.includes(input.status)) throw DomainError.validation("A programme is active or closed.");
  return { name, code: text(input.code, 40), description: text(input.description, 2000), status: input.status ?? "ACTIVE" };
}

export interface GrantInput {
  title: string; donorName: string; programmeId?: string; awardNumber?: string; amount?: string; currency?: string;
  startDate?: string; endDate?: string; status?: FundingStatus;
}
export interface CleanGrant {
  title: string; donorName: string; programmeId?: string | undefined; awardNumber?: string | undefined; amount?: string | undefined;
  currency?: string | undefined; startDate?: Date | undefined; endDate?: Date | undefined; status: FundingStatus;
}

export function cleanGrant(input: GrantInput): CleanGrant {
  const title = text(input.title, 200);
  const donorName = text(input.donorName, 160);
  if (!title) throw DomainError.validation("Give the grant a title.");
  if (!donorName) throw DomainError.validation("Name the donor that funds this grant.");
  if (input.status !== undefined && !FUNDING_STATUSES.includes(input.status)) throw DomainError.validation("A grant is active or closed.");
  const amountText = text(input.amount, 30)?.replace(/,/g, "");
  let amount: string | undefined;
  let currency: string | undefined;
  if (amountText !== undefined) {
    if (!/^\d+(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) throw DomainError.validation("The amount must be a positive number, such as 250000 or 250000.50.");
    currency = text(input.currency, 3)?.toUpperCase();
    if (!currency || !/^[A-Z]{3}$/.test(currency)) throw DomainError.validation("Give the currency as a three-letter code, such as USD or EUR.");
    amount = amountText;
  }
  const startDate = input.startDate ? new Date(input.startDate) : undefined;
  const endDate = input.endDate ? new Date(input.endDate) : undefined;
  if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) throw DomainError.validation("Use real dates for the grant period.");
  if (startDate && endDate && endDate < startDate) throw DomainError.validation("The grant cannot end before it starts.");
  return { title, donorName, programmeId: text(input.programmeId, 80), awardNumber: text(input.awardNumber, 80), amount, currency, startDate, endDate, status: input.status ?? "ACTIVE" };
}

export interface FundedProject {
  id: string;
  title: string;
  status: string;
  programmeId?: string | null | undefined;
  grantId?: string | null | undefined;
  budget?: { amount: number | string; currency: string } | undefined;
}

export interface FundingTotals {
  projectCount: number;
  activeProjectCount: number;
  /** Project budgets by currency: currencies are never added together. */
  budgetByCurrency: Record<string, number>;
  /** Grant amounts by currency. */
  awardedByCurrency: Record<string, number>;
}

const round = (n: number): number => Math.round(n * 100) / 100;
const FINISHED_PROJECT_STATUSES = new Set(["COMPLETED", "ARCHIVED", "CLOSED", "CANCELLED"]);

/** What a programme (or a grant) adds up to over the projects and grants under it. Different currencies stay apart. */
export function summarizeFunding(projects: ReadonlyArray<FundedProject>, grants: ReadonlyArray<Pick<GrantRecord, "amount" | "currency">>): FundingTotals {
  const budgetByCurrency: Record<string, number> = {};
  for (const project of projects) {
    if (!project.budget) continue;
    const amount = Number(project.budget.amount);
    if (!Number.isFinite(amount)) continue;
    budgetByCurrency[project.budget.currency] = round((budgetByCurrency[project.budget.currency] ?? 0) + amount);
  }
  const awardedByCurrency: Record<string, number> = {};
  for (const grant of grants) {
    if (!grant.amount || !grant.currency) continue;
    awardedByCurrency[grant.currency] = round((awardedByCurrency[grant.currency] ?? 0) + Number(grant.amount));
  }
  return {
    projectCount: projects.length,
    activeProjectCount: projects.filter((p) => !FINISHED_PROJECT_STATUSES.has(p.status)).length,
    budgetByCurrency,
    awardedByCurrency,
  };
}
