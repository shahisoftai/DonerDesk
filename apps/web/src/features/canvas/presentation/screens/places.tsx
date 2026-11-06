import type { activitiesByLocationModel, locationComparisonModel, locationResultsModel, reachModel, ScreenRendererPropsOf } from "./types";
import { Bar, readyOrNothing } from "./screen-text";

export function ReachScreen(props: ScreenRendererPropsOf<typeof reachModel>) {
  return readyOrNothing(props, (m, text) => {
    const max = Math.max(1, ...m.rows.map((r) => r.unique));
    return (
      <div className="p-4">
        <p className="text-xl font-bold">{text.fmt(m.overallUnique)} {text.l.uniquePeople}</p>
        <p className="text-xs text-slate-500">{text.fmt(m.registeredTotal)} {text.l.registeredInTotal}</p>
        <ul className="mt-3 space-y-2">
          {m.rows.map((r) => <li key={r.location}><p className="flex justify-between text-sm"><span>{r.location}</span><span>{text.fmt(r.unique)}</span></p><Bar fraction={r.unique / max} tone="bg-teal-600" /></li>)}
        </ul>
        <p className="mt-2 text-end text-xs text-slate-500">{text.fmt(m.attendances)} {text.l.attendancesNote}</p>
      </div>
    );
  });
}

export function ActivitiesByLocationScreen(props: ScreenRendererPropsOf<typeof activitiesByLocationModel>) {
  return readyOrNothing(props, (m, text) => {
    const max = Math.max(1, ...m.rows.map((r) => r.planned));
    return (
      <div className="p-4">
        <ul className="space-y-2">
          {m.rows.map((r) => (
            <li key={r.location}>
              <p className="flex justify-between text-sm"><span>{r.location}</span><span className="text-slate-500">{r.done} / {r.planned} {text.l.done}{r.late ? ` · ${r.late} ${text.l.late}` : ""}</span></p>
              <Bar fraction={Math.max(r.done / max, 0)} />
            </li>
          ))}
        </ul>
        {m.unlocated > 0 && <p className="mt-2 text-xs text-slate-500">{m.unlocated} {text.l.activitiesWithoutLocation}</p>}
      </div>
    );
  });
}

export function LocationResultsScreen(props: ScreenRendererPropsOf<typeof locationResultsModel>) {
  return readyOrNothing(props, (m, text) => (
    <table className="w-full text-sm">
      <thead><tr className="text-xs text-slate-500"><th className="px-3 py-1 text-start">{text.l.location}</th><th className="px-3 py-1 text-end">{text.l.target}</th><th className="px-3 py-1 text-end">{text.l.achieved}</th><th className="px-3 py-1 text-end">{text.l.percentOfTarget}</th></tr></thead>
      <tbody>
        {m.rows.map((r, i) => (
          <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
            <td className="px-3 py-1 font-semibold">{r.indicator} {r.location}</td>
            <td className={`px-3 py-1 text-end ${r.target ? "" : "italic text-slate-500"}`}>{r.target ?? text.l.notPlanned}</td>
            <td className={`px-3 py-1 text-end ${r.actual ? (r.verified === false ? "text-amber-700" : "") : "italic text-slate-500"}`}>{r.actual ?? text.l.notReported}</td>
            <td className="px-3 py-1 text-end">{r.percentOfTarget ? `${r.percentOfTarget}%` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ));
}

export function LocationComparisonScreen(props: ScreenRendererPropsOf<typeof locationComparisonModel>) {
  return readyOrNothing(props, (m) => (
    <table className="w-full text-sm">
      <thead><tr className="text-xs text-slate-500"><th className="px-3 py-1" />{m.columns.map((c) => <th key={c.code} className="px-3 py-1 text-start">{c.code} {c.name}</th>)}</tr></thead>
      <tbody>
        {m.rows.map((row) => (
          <tr key={row.location} className="border-t border-slate-100 dark:border-slate-800">
            <th scope="row" className="px-3 py-1 text-start font-semibold">{row.location}</th>
            {row.cells.map((cell, i) => <td key={i} className={`px-3 py-1 ${cell ? (cell.verified ? "" : "text-amber-700") : "text-slate-400"}`}>{cell ? cell.value : "—"}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  ));
}
