import type { demographicsModel, fundingModel, ModelOf, ScreenRendererPropsOf } from "./types";
import { Bar, readyOrNothing, type ScreenText } from "./screen-text";

type Demographics = ModelOf<typeof demographicsModel>;
const sexName = (text: ScreenText, s: Demographics["sex"][number]): string =>
  s.kind === "FEMALE" ? text.l.female : s.kind === "MALE" ? text.l.male : s.kind === "OTHER" ? text.l.other : s.kind === "UNKNOWN" ? text.l.unknown : s.key;
function ageName(text: ScreenText, a: Demographics["ages"][number]): string {
  const g = a.group;
  if (g.kind === "UNDER_5") return text.l.ageUnder5;
  if (g.kind === "60_PLUS") return text.l.age60Plus;
  if (g.kind === "RANGE") return `${g.from}–${g.to}`;
  if (g.kind === "OPEN") return `${g.from}+`;
  if (g.kind === "UNKNOWN") return text.l.unknown;
  return g.text;
}

export function DemographicsScreen(props: ScreenRendererPropsOf<typeof demographicsModel>) {
  return readyOrNothing(props, (m, text) => {
    const max = Math.max(1, ...m.ages.map((a) => a.count));
    return (
      <div className="space-y-3 p-4">
        {m.sex.length > 0 && (
          <section aria-label={text.l.sex}>
            <h4 className="text-xs font-bold text-slate-500">{text.l.sex}</h4>
            <ul className="flex flex-wrap gap-x-4 text-sm">{m.sex.map((g) => <li key={g.key}>{sexName(text, g)} {text.fmt(g.count)} ({g.percent}%)</li>)}</ul>
          </section>
        )}
        {m.ages.length > 0 && (
          <section aria-label={text.l.ageGroup}>
            <h4 className="text-xs font-bold text-slate-500">{text.l.ageGroup}</h4>
            <ul className="space-y-1">{m.ages.map((a) => <li key={a.key}><p className="flex justify-between text-sm"><span>{ageName(text, a)}</span><span>{text.fmt(a.count)}</span></p><Bar fraction={a.count / max} /></li>)}</ul>
          </section>
        )}
      </div>
    );
  });
}

export function FundingScreen(props: ScreenRendererPropsOf<typeof fundingModel>) {
  return readyOrNothing(props, (m, text) => (
    <table className="w-full text-sm">
      <tbody>
        {m.rows.map((r) => (
          <tr key={r.period} className="border-t border-slate-100 dark:border-slate-800">
            <th scope="row" className="px-3 py-2 text-start font-semibold">{r.period}</th>
            <td className="px-3 py-2 text-end text-slate-600">{text.l.budget} {r.currency} {r.budget !== null ? text.fmt(r.budget) : r.budgetText}</td>
            <td className={`px-3 py-2 text-end ${r.verified ? "" : "text-amber-700"}`}>{text.l.expenditure} {r.expenditure !== null ? text.fmt(r.expenditure) : r.expenditureText}{r.burnRatePercent ? ` · ${r.burnRatePercent}%` : ""}{r.verified ? "" : ` · ${text.l.notVerifiedYet}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ));
}
