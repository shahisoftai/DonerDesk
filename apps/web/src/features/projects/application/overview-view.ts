import type { BudgetPace, CalendarItem, HeadlineIndicator, Lifecycle, Movement, NeedsYouItem, ResultsPace, WeekItem } from "../domain/overview-derive";
import type { OutputProgress, PlanCounts } from "@/features/workplan/domain/delivery-overview";
import type { RiskItem } from "@/lib/server/schemas";
import type { ProjectPerson } from "@/features/tasks/domain/ask-people";
import type { z } from "zod";
import type { ReadinessSchema } from "@/lib/server/schemas";

/**
 * What the Overview page renders, as data. One type per section, each holding only what that
 * section shows (interface segregation): a section never has to satisfy another section's shape.
 *
 * A section that could not be loaded says so (`ok: false`) instead of showing an empty card, so one
 * failing call never breaks the page.
 */
export type SectionData<T> = { ok: true; value: T } | { ok: false };

/** The readiness of a reporting period, as the API sends it. */
export type ReadinessBreakdown = z.infer<typeof ReadinessSchema>;

export interface OverviewIdentity {
  id: string;
  title: string;
  projectCode: string;
  donorName: string;
  country: string;
  sector: string;
  status: string;
  reportingFrequency: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isDemo: boolean | undefined;
}

export interface PulseDelivery {
  band: string;
  label: string;
  reasons: string[];
  done: number;
  planned: number;
  late: number;
}

export interface PulseData {
  delivery: PulseDelivery | null;
  results: ResultsPace | null;
  budget: { pace: BudgetPace[]; timeElapsedPercent: number } | null;
  nextDeadline: { title: string; date: string; days: number; readiness: number } | null;
  people: { total: number; bySex: { label: string; count: number }[] } | null;
  compliance: { open: number; needsPerson: number; settled: number } | null;
  time: { daysRemaining: number; timeElapsedPercent: number; endDate: string };
}

export interface ReportingPeriodView {
  id: string;
  title: string;
  reportType: string;
  status: string;
  readiness: number;
  deadline: string;
  daysUntilDeadline: number;
  current: boolean;
}

export interface ReportingData {
  periods: ReportingPeriodView[];
  activePeriodId: string | null;
  /** The readiness of the period in view; null when the page could not read it. */
  readiness: ReadinessBreakdown | null;
  blockers: { label: string; detail: string; href: string }[];
  compliance: { id: string; title: string; severity: string; status: string }[];
}

export interface DeliveryData {
  counts: PlanCounts;
  health: { band: string; label: string; reasons: string[] } | null;
  movements: Movement[];
  week: WeekItem[];
  outputs: OutputProgress[];
  people: ProjectPerson[];
}

export interface ResultsIndicatorView {
  id: string;
  code: string;
  name: string;
  level: string | null;
  isRate: boolean;
  /** Share of target at the latest period, or null when it was never measured. */
  percent: number | null;
  baseline: string;
  target: string;
  latest: string;
}

export interface ResultsData {
  indicators: ResultsIndicatorView[];
  headline: HeadlineIndicator | null;
  finance: { periodId: string; label: string; budget: string; expenditure: string; burn: string | null; verified: boolean }[];
  budgetPace: BudgetPace[];
  timeElapsedPercent: number;
}

export interface TeamData {
  rows: { userId: string; name: string; role: string; open: number; late: number; dueThisWeek: number }[];
  requests: { key: string; title: string; dueDate: string | null; state: string; href: string; urgent: boolean; /** Who it is for, by name. */ assignee: string }[];
}

export interface RisksData {
  items: RiskItem[];
  people: ProjectPerson[];
}

export interface CloseOutData {
  monthsRemaining: number;
  finalPeriod: { id: string; title: string } | null;
  steps: { key: string; label: string; status: string; detail: string; href: string | null }[];
  todoCount: number;
}

export interface SetupData {
  logframe: { outcomes: number; outputs: number; indicators: number; archived: number } | null;
  templates: number | null;
  profile: { reportingFrequency: string; autoCreate: boolean | null; secondApprover: boolean | null };
}
