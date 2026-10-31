/**
 * Cross-area consistency checks (Phase 36): what `groundProposed` cannot know because it needs more than one area — an
 * indicator naming a logframe code that does not exist, a period reaching past the project's end, a budget row without a
 * currency. Problems never block viewing; only the HARD ones block Apply, and each carries a code the web translates, a
 * path to the item, and the values the sentence needs. Checks run over every item a person has not rejected. Pure.
 */
import { compareDates, isPlainDate } from "../workplan/plain-date.js";
import type { ProjectSetupProposal, Proposed } from "./proposal.js";

export type SetupProblemSeverity = "HARD" | "SOFT";

/** The one list of problem codes; mirrored in `packages/contracts/src/project-setup.ts` and pinned by the architecture test. */
export const SETUP_PROBLEM_CODES = [
  "FACTS_NAME_REQUIRED",
  "LOGFRAME_CYCLE",
  "LOGFRAME_PARENT_UNKNOWN",
  "LOGFRAME_DUPLICATE_CODE",
  "INDICATOR_DUPLICATE_CODE",
  "INDICATOR_LOGFRAME_UNKNOWN",
  "END_BEFORE_START",
  "PERIOD_OUTSIDE_DATES",
  "ACTIVITY_OUTSIDE_DATES",
  "CURRENCY_NOT_STATED",
] as const;

export type SetupProblemCode = (typeof SETUP_PROBLEM_CODES)[number];

export interface SetupProblem {
  code: SetupProblemCode;
  /** Where in the proposal the problem is ("logframe.2.parentCode"). */
  path: string;
  /** HARD blocks Apply until fixed; SOFT is advice shown while reviewing. */
  severity: SetupProblemSeverity;
  /** English sentence for the server and the tests; a screen translates from the code and `params`. */
  message: string;
  params?: Record<string, string | number>;
}

/** The problems Apply refuses until a person fixes them. */
export const blockingProblems = (problems: ReadonlyArray<SetupProblem>): SetupProblem[] =>
  problems.filter((p) => p.severity === "HARD");

const live = <T>(item: Proposed<T>): boolean => item.status !== "REJECTED";

const stated = (item: Proposed<string>): string | null => (live(item) && item.value !== null ? item.value : null);

const plainDay = (item: Proposed<string>): string | null => {
  const value = stated(item);
  return value !== null && isPlainDate(value) ? value : null;
};

/** A duplicate code is reported at the second and later occurrences, naming the code and the earlier item. */
function duplicates(codes: ReadonlyArray<{ path: string; code: string | null }>, kind: "logframe" | "indicator"): SetupProblem[] {
  const problems: SetupProblem[] = [];
  const seen = new Map<string, string>();
  for (const { path, code } of codes) {
    if (code === null) continue;
    const first = seen.get(code);
    if (first !== undefined) {
      problems.push({
        code: kind === "logframe" ? "LOGFRAME_DUPLICATE_CODE" : "INDICATOR_DUPLICATE_CODE",
        path,
        severity: "HARD",
        message: `Two ${kind} entries share the code ${code}.`,
        params: { code, first },
      });
    } else {
      seen.set(code, path);
    }
  }
  return problems;
}

function checkLogframe(proposal: ProjectSetupProposal): SetupProblem[] {
  const problems: SetupProblem[] = [];
  const nodes = proposal.logframe.map((n, i) => ({ item: n, path: `logframe.${i}` })).filter((n) => live(n.item));
  problems.push(...duplicates(nodes.map((n) => ({ path: n.path, code: n.item.value?.code ?? null })), "logframe"));
  const byCode = new Map<string, string>();
  for (const { path, item } of nodes) {
    const code = item.value?.code;
    if (typeof code === "string" && code && !byCode.has(code)) byCode.set(code, path);
  }
  const parentOf = new Map<string, string | undefined>();
  for (const { path, item } of nodes) {
    const parent = item.value?.parentCode;
    if (typeof parent === "string" && parent) {
      parentOf.set(path, byCode.get(parent));
      if (!byCode.has(parent)) {
        problems.push({
          code: "LOGFRAME_PARENT_UNKNOWN",
          path: `${path}.parentCode`,
          severity: "HARD",
          message: `The parent code ${parent} is not the code of any proposed logframe entry.`,
          params: { code: parent },
        });
      }
    }
  }
  const done = new Set<string>();
  for (const { path } of nodes) {
    const chain = new Set<string>();
    let current: string | undefined = path;
    while (current !== undefined && !done.has(current) && !chain.has(current)) {
      chain.add(current);
      current = parentOf.get(current);
    }
    if (current !== undefined && chain.has(current)) {
      problems.push({
        code: "LOGFRAME_CYCLE",
        path: `${current}.parentCode`,
        severity: "HARD",
        message: "A proposed logframe entry is its own ancestor: the parent codes make a cycle.",
        params: {},
      });
    }
    for (const step of chain) done.add(step);
  }
  return problems;
}

function checkIndicators(proposal: ProjectSetupProposal): SetupProblem[] {
  const problems: SetupProblem[] = [];
  const indicators = proposal.indicators.map((item, i) => ({ item, path: `indicators.${i}` })).filter((x) => live(x.item));
  problems.push(...duplicates(indicators.map((x) => ({ path: x.path, code: x.item.value?.code ?? null })), "indicator"));
  const logframeCodes = new Set(
    proposal.logframe.filter(live).flatMap((n) => (typeof n.value?.code === "string" ? [n.value.code] : [])),
  );
  for (const { path, item } of indicators) {
    const logframeCode = item.value?.logframeCode;
    if (typeof logframeCode === "string" && logframeCode && !logframeCodes.has(logframeCode)) {
      problems.push({
        code: "INDICATOR_LOGFRAME_UNKNOWN",
        path: `${path}.logframeCode`,
        severity: "HARD",
        message: `An indicator names a logframe code (${logframeCode}) that no proposed logframe entry has.`,
        params: { code: logframeCode },
      });
    }
  }
  return problems;
}

function checkPeriods(proposal: ProjectSetupProposal, factsStart: string | null, factsEnd: string | null): SetupProblem[] {
  const problems: SetupProblem[] = [];
  proposal.periods.forEach((item, i) => {
    if (!live(item)) return;
    const { start, end } = item.value ?? {};
    if (start && end && isPlainDate(start) && isPlainDate(end) && compareDates(end, start) < 0) {
      problems.push({
        code: "END_BEFORE_START", path: `periods.${i}`, severity: "HARD",
        message: `The period ending ${end} starts after it ends (${start}).`, params: { start, end },
      });
    }
    if (factsStart && factsEnd && start && isPlainDate(start) && compareDates(start, factsStart) < 0) {
      problems.push({
        code: "PERIOD_OUTSIDE_DATES", path: `periods.${i}`, severity: "SOFT",
        message: `A period starts (${start}) before the project does (${factsStart}).`, params: { date: start },
      });
    } else if (factsEnd && end && isPlainDate(end) && compareDates(end, factsEnd) > 0) {
      problems.push({
        code: "PERIOD_OUTSIDE_DATES", path: `periods.${i}`, severity: "SOFT",
        message: `A period ends (${end}) after the project does (${factsEnd}).`, params: { date: end },
      });
    }
  });
  return problems;
}

function checkPlan(proposal: ProjectSetupProposal, factsStart: string | null, factsEnd: string | null): SetupProblem[] {
  const problems: SetupProblem[] = [];
  proposal.plan.forEach((item, i) => {
    if (!live(item)) return;
    const { start, end } = item.value ?? {};
    if (start && end && isPlainDate(start) && isPlainDate(end) && compareDates(end, start) < 0) {
      problems.push({
        code: "END_BEFORE_START", path: `plan.${i}`, severity: "HARD",
        message: `The planned activity ending ${end} starts after it ends (${start}).`, params: { start, end },
      });
    }
    for (const date of [start, end]) {
      if (!date || !isPlainDate(date)) continue;
      if ((factsStart && compareDates(date, factsStart) < 0) || (factsEnd && compareDates(date, factsEnd) > 0)) {
        problems.push({
          code: "ACTIVITY_OUTSIDE_DATES", path: `plan.${i}`, severity: "SOFT",
          message: `A planned activity is dated ${date}, outside the project's dates (${factsStart ?? "?"} to ${factsEnd ?? "?"}).`,
          params: { date },
        });
        break;
      }
    }
  });
  return problems;
}

function checkCurrency(
  rows: ReadonlyArray<Proposed<{ currency: string | null }>>,
  field: "funding" | "budget",
): SetupProblem[] {
  const out: SetupProblem[] = [];
  rows.forEach((item, i) => {
    if (!live(item)) return;
    if (item.value === null || item.value.currency === null) {
      out.push({
        code: "CURRENCY_NOT_STATED", path: `${field}.${i}`, severity: "SOFT",
        message: field === "funding"
          ? "A funding source states no currency, and none is assumed."
          : "A budget line states no currency, and none is assumed.",
        params: {},
      });
    }
  });
  return out;
}

/**
 * Everything wrong with a proposal across areas. An empty list still needs a person's review; it only means nothing here
 * would refuse to apply.
 */
export function checkProposal(proposal: ProjectSetupProposal): SetupProblem[] {
  const problems: SetupProblem[] = [];
  const name = proposal.facts.name;
  if (live(name) && name.value === null) {
    problems.push({
      code: "FACTS_NAME_REQUIRED", path: "facts.name", severity: "HARD",
      message: "The project has no name, so it cannot be created.", params: {},
    });
  }
  const factsStart = plainDay(proposal.facts.startDate);
  const factsEnd = plainDay(proposal.facts.endDate);
  if (factsStart && factsEnd && compareDates(factsEnd, factsStart) < 0) {
    problems.push({
      code: "END_BEFORE_START", path: "facts.endDate", severity: "HARD",
      message: `The project ends (${factsEnd}) before it starts (${factsStart}).`, params: { start: factsStart, end: factsEnd },
    });
  }
  problems.push(...checkLogframe(proposal));
  problems.push(...checkIndicators(proposal));
  problems.push(...checkPeriods(proposal, factsStart, factsEnd));
  problems.push(...checkPlan(proposal, factsStart, factsEnd));
  problems.push(...checkCurrency(proposal.funding, "funding"));
  problems.push(...checkCurrency(proposal.budget, "budget"));
  return problems;
}
