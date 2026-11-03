"use client";

import { useMemo, useState } from "react";
import { forScreen, optionToTable } from "@donordesk/domain/contexts/reporting/chart-screen.js";
import { useLowData } from "@/features/design/presentation/use-low-data";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { DashboardChart } from "../DashboardChart";

type Chart = NonNullable<ChartDrawing["chart"]>;

/**
 * A chart with a "View data" switch: the table of exactly the values the picture is drawn from (it is read from the same option, so the two
 * cannot disagree), which is also the way for a keyboard or screen-reader user to read the numbers. A picture that is not a table of
 * values (a map, a timeline) says so instead of offering an empty table.
 */
export function ChartBody({ chart, onPick, hoverName, onHover }: { chart: Chart; onPick?: ((name: string) => void) | undefined; hoverName?: string | null | undefined; onHover?: ((name: string | null) => void) | undefined }) {
  const { lowData } = useLowData();
  const [chosen, setChosen] = useState<boolean | null>(null);
  // Low-data mode shows the table until the person asks for the picture; a person's own choice on this tile always wins.
  const asTable = chosen ?? lowData;
  const screen = useMemo(() => forScreen(chart.option), [chart.option]);
  const table = useMemo(() => optionToTable(chart.option), [chart.option]);
  return (
    <div className="relative h-full min-h-0">
      {asTable ? (
        <div className="h-full overflow-auto p-2" data-testid="chart-data">
          {table ? (
            <table className="w-full text-xs">
              <thead><tr>{table.columns.map((c, i) => <th key={i} scope="col" className="border-b border-[var(--tile-border)] px-2 py-1 text-start font-semibold">{c}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-[var(--tile-border)]">{r.map((c, j) => (j === 0 ? <th key={j} scope="row" className="px-2 py-1 text-start font-normal">{c}</th> : <td key={j} className="px-2 py-1 tabular-nums">{c}</td>))}</tr>)}</tbody>
            </table>
          ) : <p className="p-2 text-sm text-[var(--tile-meta)]">This picture is not a table of values. The notes under it say what it shows.</p>}
        </div>
      ) : (
        <DashboardChart option={screen.option} label={chart.title} maps={chart.maps} regionNames={chart.regionNames} onPick={onPick} hoverName={hoverName} onHover={onHover} />
      )}
      <button type="button" aria-pressed={asTable} onClick={() => setChosen(!asTable)} className="absolute end-1 top-0 z-10 rounded border border-[var(--tile-border)] bg-[var(--tile-bg)] px-2 py-0.5 text-xs text-[var(--tile-meta)] hover:bg-[var(--tile-header-bg)] [@media(pointer:coarse)]:min-h-11">
        {asTable ? "View chart" : "View data"}
      </button>
    </div>
  );
}
