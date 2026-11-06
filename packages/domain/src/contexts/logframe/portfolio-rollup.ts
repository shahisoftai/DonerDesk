/**
 * Roll-up across projects (phase 28.1-F): for each donor and indicator code, the verified value of every project that
 * reports it, and their sum. Only VERIFIED values are summed; a project with none is listed as not measured, never as 0.
 * Projects whose indicator with the same code differs in unit or type are listed separately and not summed.
 */
export interface PortfolioIndicatorValue {
  projectId: string;
  projectTitle: string;
  donorName: string;
  indicatorCode: string;
  indicatorName: string;
  unit: string | null;
  type: string;
  target: number | null;
  /** The latest verified cumulative value, or null when nothing is verified yet. */
  verifiedCumulative: number | null;
  /** The reporting-period end the verified value belongs to (YYYY-MM-DD). */
  verifiedAsOf: string | null;
  /** Set on the indicator when what it counts is also counted by another project: it is listed, never added. */
  countedElsewhere?: boolean | undefined;
  /** Where and when the project works; two projects that share both may be counting the same people. */
  country?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export interface RollupProject {
  projectId: string;
  projectTitle: string;
  value: number | null;
  target: number | null;
  asOf: string | null;
}

export interface RollupGroup {
  donorName: string;
  indicatorCode: string;
  indicatorName: string;
  unit: string | null;
  /** Sum of the verified values; null when no project has verified one yet. */
  total: number | null;
  /** Sum of the targets that are numbers; null when none is set. */
  targetTotal: number | null;
  /** The share of the total target, when both are known. Only for a count-type indicator with a target. */
  percentOfTarget: number | null;
  projects: RollupProject[];
  /** Projects whose unit or type differs from the rest of the group: listed, not summed. */
  mismatched: RollupProject[];
  /** Projects whose indicator is marked as counted by another project: listed, not summed. */
  countedElsewhere: RollupProject[];
  /** Counted projects that share a country and overlapping dates: if they reach the same people, the total counts them twice. */
  possibleOverlap: { projects: string[]; message: string } | null;
}

const overlaps = (a: { startDate?: string | undefined; endDate?: string | undefined }, b: { startDate?: string | undefined; endDate?: string | undefined }): boolean =>
  !!a.startDate && !!a.endDate && !!b.startDate && !!b.endDate && a.startDate <= b.endDate && b.startDate <= a.endDate;

/** Counted projects in the same country whose dates overlap. Never changes a total: it only says the total may count a person twice. */
export function findPossibleOverlap(counted: ReadonlyArray<PortfolioIndicatorValue>): { projects: string[]; message: string } | null {
  const titles = new Set<string>();
  for (let i = 0; i < counted.length; i += 1) {
    for (let j = i + 1; j < counted.length; j += 1) {
      const a = counted[i]!;
      const b = counted[j]!;
      if (!a.country || !b.country || a.country.trim().toLowerCase() !== b.country.trim().toLowerCase()) continue;
      if (!overlaps(a, b)) continue;
      titles.add(a.projectTitle);
      titles.add(b.projectTitle);
    }
  }
  if (titles.size === 0) return null;
  const projects = [...titles].sort((x, y) => x.localeCompare(y));
  return { projects, message: "These projects work in the same country at the same time. If they reach the same people, the total counts them twice: mark the indicator on one of them as counted by another project." };
}

const sumOrNull = (xs: Array<number | null>): number | null => {
  const present = xs.filter((x): x is number => x !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

/** Groups by donor and code (the unit of comparison), then splits off any project that does not share the group's unit and type. */
export function rollUpIndicators(rows: ReadonlyArray<PortfolioIndicatorValue>): RollupGroup[] {
  const groups = new Map<string, PortfolioIndicatorValue[]>();
  for (const row of rows) {
    const key = `${row.donorName}\u0000${row.indicatorCode}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()]
    .map((members) => {
      const head = members[0]!;
      const sameAs = (r: PortfolioIndicatorValue) => (r.unit ?? "") === (head.unit ?? "") && r.type === head.type;
      const counted = members.filter((r) => sameAs(r) && !r.countedElsewhere);
      const countedElsewhere = members.filter((r) => sameAs(r) && r.countedElsewhere).map(toProject);
      const mismatched = members.filter((r) => !sameAs(r)).map(toProject);
      const projects = counted.map(toProject);
      const total = sumOrNull(counted.map((r) => r.verifiedCumulative));
      const targetTotal = sumOrNull(counted.map((r) => r.target));
      const percentOfTarget = total !== null && targetTotal && head.type !== "PERCENTAGE" ? Math.round((total / targetTotal) * 1000) / 10 : null;
      return {
        donorName: head.donorName, indicatorCode: head.indicatorCode, indicatorName: head.indicatorName, unit: head.unit,
        total, targetTotal, percentOfTarget, projects, mismatched, countedElsewhere, possibleOverlap: findPossibleOverlap(counted),
      };
    })
    .sort((a, b) => a.donorName.localeCompare(b.donorName) || a.indicatorCode.localeCompare(b.indicatorCode, undefined, { numeric: true }));
}

function toProject(r: PortfolioIndicatorValue): RollupProject {
  return { projectId: r.projectId, projectTitle: r.projectTitle, value: r.verifiedCumulative, target: r.target, asOf: r.verifiedAsOf };
}

export const ROLLUP_TABLE_HEADER = ["Donor", "Indicator code", "Indicator", "Unit", "Project", "Verified value", "As of", "Project target", "Total of the group", "Target of the group", "% of target", "Note"] as const;

/**
 * The roll-up as rows for a spreadsheet: one row per project in each group. A value nobody has verified reads "Not measured", never 0.
 * A project whose unit or type differs is listed with a note and is not part of the group's total.
 */
export function rollupTable(groups: ReadonlyArray<RollupGroup>): string[][] {
  const num = (n: number | null, empty: string): string => (n === null ? empty : String(n));
  const rows: string[][] = [[...ROLLUP_TABLE_HEADER]];
  for (const g of groups) {
    const group = [num(g.total, "Not measured"), num(g.targetTotal, ""), g.percentOfTarget === null ? "" : `${g.percentOfTarget}%`];
    for (const p of g.projects) {
      rows.push([g.donorName, g.indicatorCode, g.indicatorName, g.unit ?? "", p.projectTitle, num(p.value, "Not measured"), p.asOf ?? "", num(p.target, ""), ...group, ""]);
    }
    for (const p of g.countedElsewhere) {
      rows.push([g.donorName, g.indicatorCode, g.indicatorName, g.unit ?? "", p.projectTitle, num(p.value, "Not measured"), p.asOf ?? "", num(p.target, ""), ...group, "Counted by another project: not added to the total"]);
    }
    for (const p of g.mismatched) {
      rows.push([g.donorName, g.indicatorCode, g.indicatorName, g.unit ?? "", p.projectTitle, num(p.value, "Not measured"), p.asOf ?? "", num(p.target, ""), ...group, "Different unit or type: not added to the total"]);
    }
    if (g.possibleOverlap) rows.push([g.donorName, g.indicatorCode, g.indicatorName, "", g.possibleOverlap.projects.join("; "), "", "", "", ...group, "Possible double count: " + g.possibleOverlap.message]);
  }
  return rows;
}
