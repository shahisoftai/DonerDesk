import type { ScreenRendererPropsOf } from "./types";
import type { portfolioCountriesModel, portfolioHealthModel, portfolioSummaryModel, portfolioTableModel } from "./types";
import { readyOrNothing, type ScreenText } from "./screen-text";

const BAND_TONE: Record<string, string> = { ON_TRACK: "bg-emerald-600", AT_RISK: "bg-amber-500", OFF_TRACK: "bg-red-600", NO_PLAN: "bg-slate-400" };
const bandLabel = (t: ScreenText, band: string): string => (band === "ON_TRACK" ? t.l.onTrack : band === "OFF_TRACK" ? t.l.offTrack : band === "AT_RISK" ? t.l.atRisk : t.l.noPlan);

export function PortfolioSummaryScreen(props: ScreenRendererPropsOf<typeof portfolioSummaryModel>) {
  return readyOrNothing(props, (m, text) => {
    const labels: Record<string, string> = { projects: text.l.projectsWord, countries: text.l.countriesWord, offTrack: text.l.offTrack, atRisk: text.l.atRisk, openRisks: text.l.openRisks, reportsOverdue: text.l.reportsOverdue };
    return (
      <div>
        <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-6">
          {m.cards.map((card) => (
            <li key={card.key} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
              <p className={`text-2xl font-bold ${card.value > 0 && card.tone === "LATE" ? "text-red-700" : card.value > 0 && card.tone === "WARN" ? "text-amber-700" : ""}`}>{text.fmt(card.value)}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{labels[card.key]}</p>
            </li>
          ))}
        </ul>
        {m.asAt && <p className="px-4 pb-2 text-xs text-slate-500">{text.l.asAt} {m.asAt}</p>}
      </div>
    );
  });
}

export function PortfolioHealthScreen(props: ScreenRendererPropsOf<typeof portfolioHealthModel>) {
  return readyOrNothing(props, (m, text) => {
    const total = m.parts.reduce((n, p) => n + p.count, 0) || 1;
    return (
      <div className="space-y-3 p-4">
        <div className="flex h-7 overflow-hidden rounded" role="img" aria-label={m.parts.map((p) => `${bandLabel(text, p.band)}: ${p.count}`).join(", ")}>
          {m.parts.map((p) => <span key={p.band} className={`${BAND_TONE[p.band]} flex items-center justify-center text-xs font-bold text-white`} style={{ width: `${(p.count / total) * 100}%` }}>{p.count}</span>)}
        </div>
        <ul className="space-y-1 text-sm">{m.parts.map((p) => <li key={p.band} className="flex items-center gap-2"><span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${BAND_TONE[p.band]}`} />{bandLabel(text, p.band)}: {p.count}</li>)}</ul>
      </div>
    );
  });
}

export function PortfolioCountriesScreen(props: ScreenRendererPropsOf<typeof portfolioCountriesModel>) {
  return readyOrNothing(props, (m) => {
    const max = Math.max(1, ...m.countries.map((c) => c.projects));
    return (
      <ul className="space-y-2 p-4">
        {m.countries.map((c) => (
          <li key={c.country} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate">{c.country}</span>
            <span className="flex h-4 flex-1" aria-hidden="true">
              {([["ON_TRACK", c.onTrack], ["AT_RISK", c.atRisk], ["OFF_TRACK", c.offTrack], ["NO_PLAN", c.noPlan]] as const).filter(([, n]) => n > 0).map(([band, n]) => <span key={band} className={BAND_TONE[band]} style={{ width: `${(n / max) * 100}%` }} />)}
            </span>
            <span className="w-6 text-end font-bold">{c.projects}</span>
          </li>
        ))}
        {m.more > 0 && <li className="text-xs text-slate-500">+{m.more}</li>}
      </ul>
    );
  });
}

export function PortfolioTableScreen(props: ScreenRendererPropsOf<typeof portfolioTableModel>) {
  return readyOrNothing(props, (m, text) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-start text-xs text-slate-500"><th className="px-3 py-2 text-start">{text.l.project}</th><th className="px-3 py-2 text-start">{text.l.country}</th><th className="px-3 py-2 text-start">{text.l.donor}</th><th className="px-3 py-2 text-start">{text.l.health}</th><th className="px-3 py-2 text-end">{text.l.nextReport}</th></tr></thead>
        <tbody>
          {m.rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-1.5 font-semibold">{r.title}</td><td className="px-3 py-1.5">{r.country}</td><td className="px-3 py-1.5">{r.donorName}</td>
              <td className="px-3 py-1.5"><span aria-hidden="true" className={`me-1 inline-block h-2.5 w-2.5 rounded-full ${BAND_TONE[r.band]}`} />{bandLabel(text, r.band)}</td>
              <td className={`px-3 py-1.5 text-end ${r.nextReport && r.nextReport.daysUntil < 0 ? "text-red-700" : ""}`}>{r.nextReport ? `${r.nextReport.deadline}${r.nextReport.daysUntil < 0 ? ` · ${Math.abs(r.nextReport.daysUntil)}d ${text.l.late}` : ""}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {m.more > 0 && <p className="px-3 py-2 text-xs text-slate-500">+{m.more}</p>}
    </div>
  ));
}
