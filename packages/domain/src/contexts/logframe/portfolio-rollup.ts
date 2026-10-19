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
      const counted = members.filter(sameAs);
      const mismatched = members.filter((r) => !sameAs(r)).map(toProject);
      const projects = counted.map(toProject);
      const total = sumOrNull(counted.map((r) => r.verifiedCumulative));
      const targetTotal = sumOrNull(counted.map((r) => r.target));
      const percentOfTarget = total !== null && targetTotal && head.type !== "PERCENTAGE" ? Math.round((total / targetTotal) * 1000) / 10 : null;
      return {
        donorName: head.donorName, indicatorCode: head.indicatorCode, indicatorName: head.indicatorName, unit: head.unit,
        total, targetTotal, percentOfTarget, projects, mismatched,
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
    for (const p of g.mismatched) {
      rows.push([g.donorName, g.indicatorCode, g.indicatorName, g.unit ?? "", p.projectTitle, num(p.value, "Not measured"), p.asOf ?? "", num(p.target, ""), ...group, "Different unit or type: not added to the total"]);
    }
  }
  return rows;
}
