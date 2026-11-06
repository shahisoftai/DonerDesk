/**
 * The Overview cards: simple counts of the plan (Delivery health, until Batch 28.4 adds the plain labels) and, per output, how
 * many activities are done of planned beside the output's indicators as % of target. Pure. A rate indicator has no "% of
 * target", and a value that was never recorded is absent, never 0.
 */
import { cellPercentOfTarget, indexCells, type DataSheet } from "@donordesk/domain/contexts/reporting/data-sheet.js";

export interface OverviewRow {
  id: string;
  status: "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  state: string;
  signal: "ON_TIME" | "LATE" | "DONE" | "CANCELLED";
  outputId?: string | undefined;
}

export interface PlanCounts {
  /** Everything planned that is not cancelled. */
  planned: number;
  done: number;
  underWay: number;
  late: number;
  dueSoon: number;
}

export function planCounts(rows: ReadonlyArray<OverviewRow>): PlanCounts {
  const live = rows.filter((r) => r.status !== "CANCELLED");
  return {
    planned: live.length,
    done: live.filter((r) => r.status === "DONE").length,
    underWay: live.filter((r) => r.status === "IN_PROGRESS").length,
    late: live.filter((r) => r.signal === "LATE").length,
    dueSoon: live.filter((r) => r.state === "DUE_SOON").length,
  };
}

export interface OutputIndicatorProgress { code: string; name: string; percent: string }
export interface OutputProgress {
  outputId: string | undefined;
  title: string;
  planned: number;
  done: number;
  late: number;
  indicators: OutputIndicatorProgress[];
}

export function outputProgress(input: {
  rows: ReadonlyArray<OverviewRow>;
  outputs: ReadonlyArray<{ id: string; title: string }>;
  /** Indicators and the logframe item each belongs to (an output, or one of its activities). */
  indicators: ReadonlyArray<{ id: string; logframeItemId?: string | undefined }>;
  /** Parent of each logframe item, so an indicator on an activity counts for its output. */
  parentOf: ReadonlyMap<string, string | undefined>;
  sheet?: DataSheet | undefined;
  otherTitle: string;
}): OutputProgress[] {
  const cells = input.sheet ? indexCells(input.sheet) : undefined;
  const sheetIndicators = new Map((input.sheet?.indicators ?? []).map((i) => [i.id, i]));
  const periods = [...(input.sheet?.periods ?? [])].sort((a, b) => b.end.localeCompare(a.end));

  const ownerOutput = (itemId: string | undefined): string | undefined => {
    let id = itemId;
    for (let hops = 0; id && hops < 6; hops += 1) {
      if (input.outputs.some((o) => o.id === id)) return id;
      id = input.parentOf.get(id);
    }
    return undefined;
  };

  const keys: Array<string | undefined> = [...input.outputs.map((o) => o.id), ...(input.rows.some((r) => !r.outputId) ? [undefined] : [])];
  return keys
    .map((outputId) => {
      const mine = input.rows.filter((r) => r.outputId === outputId && r.status !== "CANCELLED");
      const indicators: OutputIndicatorProgress[] = [];
      for (const ind of input.indicators.filter((i) => outputId !== undefined && ownerOutput(i.logframeItemId) === outputId)) {
        const meta = sheetIndicators.get(ind.id);
        if (!meta || !cells) continue;
        // The latest period with something recorded: that is where the indicator stands.
        for (const p of periods) {
          const percent = cellPercentOfTarget(meta, cells.get(`${ind.id}|${p.id}`));
          if (percent) { indicators.push({ code: meta.code, name: meta.name, percent }); break; }
        }
      }
      return {
        outputId,
        title: outputId === undefined ? input.otherTitle : (input.outputs.find((o) => o.id === outputId)?.title ?? input.otherTitle),
        planned: mine.length,
        done: mine.filter((r) => r.status === "DONE").length,
        late: mine.filter((r) => r.signal === "LATE").length,
        indicators,
      };
    })
    .filter((o) => o.planned > 0);
}
