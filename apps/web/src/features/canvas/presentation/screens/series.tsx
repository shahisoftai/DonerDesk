import type { ScreenRendererPropsOf } from "./types";
import type { resultsChainModel, smallMultiplesModel } from "./types";
import { readyOrNothing } from "./screen-text";

const W = 220;
const H = 90;
const PAD = 8;

/** One indicator over time as a line: a gap stays a gap (the line breaks), a target is a dashed line, and the numbers are in the text beside it. */
function Sparkline({ points, target }: { points: Array<number | null>; target: number | null }) {
  const known = points.filter((p): p is number => p !== null);
  const all = target !== null ? [...known, target] : known;
  const lo = Math.min(0, ...all);
  const hi = Math.max(...all, lo + 1);
  const x = (i: number): number => PAD + (points.length < 2 ? 0 : (i / (points.length - 1)) * (W - PAD * 2));
  const y = (v: number): number => H - PAD - ((v - lo) / (hi - lo)) * (H - PAD * 2);
  const segments: string[] = [];
  let run: string[] = [];
  points.forEach((p, i) => { if (p === null) { if (run.length) segments.push(run.join(" ")); run = []; } else run.push(`${run.length === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p).toFixed(1)}`); });
  if (run.length) segments.push(run.join(" "));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label="Trend">
      {target !== null && <line x1={PAD} x2={W - PAD} y1={y(target)} y2={y(target)} stroke="currentColor" strokeDasharray="4 3" className="text-slate-400" />}
      {segments.map((d, i) => <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-600" />)}
      {points.map((p, i) => p === null ? null : <circle key={i} cx={x(i)} cy={y(p)} r="2.5" className="fill-sky-600" />)}
    </svg>
  );
}

export function SmallMultiplesScreen(props: ScreenRendererPropsOf<typeof smallMultiplesModel>) {
  return readyOrNothing(props, (m, text) => (
    <ul className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {m.series.map((one) => {
        const last = [...one.points].reverse().find((p) => p.value !== null);
        return (
          <li key={one.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
            <p className="truncate text-sm font-semibold">{one.code} {one.name}</p>
            <Sparkline points={one.points.map((p) => p.value)} target={one.target} />
            <p className={`text-xs ${last && !last.verified ? "text-amber-700" : "text-slate-500"}`}>{last ? `${last.label}: ${text.fmt(last.value as number)}` : text.l.notYetReported}{one.target !== null ? ` · ${text.l.target} ${text.fmt(one.target)}` : ""}</p>
          </li>
        );
      })}
    </ul>
  ));
}

export function ResultsChainScreen(props: ScreenRendererPropsOf<typeof resultsChainModel>) {
  return readyOrNothing(props, (m, text) => {
    const name = (level: string): string => (level === "IMPACT" ? text.l.impact : level === "GOAL" ? text.l.goal : level === "OUTCOME" ? text.l.outcome : level === "OUTPUT" ? text.l.output : level === "ACTIVITY" ? text.l.activity : text.l.indicators);
    return (
      <ol className="space-y-2 p-3">
        {m.levels.map((group) => (
          <li key={group.level} className="flex gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
            <p className="w-24 shrink-0 text-sm font-bold text-sky-800 dark:text-sky-300">{name(group.level)}</p>
            <ul className="min-w-0 flex-1 space-y-1">
              {group.rows.map((lv) => (
                <li key={lv.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{lv.code} {lv.name}</span>
                  <span className={`shrink-0 font-semibold ${lv.verified ? "" : "text-amber-700"}`}>{lv.number !== null ? text.fmt(lv.number) : lv.value}{lv.unit === "%" ? "%" : ""}{lv.percent !== null && lv.targetNumber !== null ? ` / ${text.fmt(lv.targetNumber)} · ${Math.round(lv.percent)}%` : ""}</span>
                </li>
              ))}
              {group.more > 0 && <li className="text-xs text-slate-500">+{group.more}</li>}
            </ul>
          </li>
        ))}
      </ol>
    );
  });
}
