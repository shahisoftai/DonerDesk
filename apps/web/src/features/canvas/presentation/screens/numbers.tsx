import type { bigNumbersModel, funnelModel, progressRingsModel, ModelOf, ScreenRendererPropsOf } from "./types";
import { Bar, readyOrNothing, type ScreenText } from "./screen-text";

type Cards = ModelOf<typeof bigNumbersModel>;

/** The words for one card's figure: typed figures as written, recorded ones formatted; a figure nobody recorded is "not yet reported", never 0. */
function figureText(text: ScreenText, card: Cards["cards"][number], rounding: Cards["rounding"]): { value: string; detail: string | undefined; muted: boolean } {
  const f = card.figure;
  if (!f) return { value: text.l.notYetReported, detail: undefined, muted: true };
  const shown = card.source === "MANUAL" ? f.text : f.amount !== null ? text.fmt(f.amount, rounding) : f.text;
  return { value: `${f.prefix ? `${f.prefix} ` : ""}${shown}${f.suffix ?? ""}`, detail: f.unverified ? text.l.notVerifiedYet : undefined, muted: false };
}

export function BigNumbersScreen(props: ScreenRendererPropsOf<typeof bigNumbersModel>) {
  return readyOrNothing(props, (m, text) => (
    <div>
      <ul className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {m.cards.map((card, i) => {
          const f = figureText(text, card, m.rounding);
          return (
            <li key={i} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900" data-figure={f.muted ? "none" : "value"}>
              <p className={f.muted ? "text-sm italic text-slate-500" : "text-2xl font-bold"}>{f.value}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{card.label}</p>
              {(card.caption ?? f.detail) && <p className={`text-xs ${f.detail && !card.caption ? "text-amber-700" : "text-slate-500"}`}>{card.caption ?? f.detail}</p>}
            </li>
          );
        })}
      </ul>
      {m.sources.length > 0 && <p className="px-4 pb-2 text-xs text-slate-500">{text.l.source}: {m.sources.join("; ")}</p>}
    </div>
  ));
}

export function ProgressRingsScreen(props: ScreenRendererPropsOf<typeof progressRingsModel>) {
  return readyOrNothing(props, (m, text) => (
    <ul className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {m.rings.map((ring) => {
        const shown = ring.amount !== null ? text.fmt(ring.amount) : ring.text;
        return (
          <li key={ring.id} className="text-center">
            <p className="text-2xl font-bold">{ring.percent !== null ? `${Math.round(ring.percent)}%` : `${shown}${ring.unit === "%" ? "%" : ""}`}</p>
            {ring.percent !== null && <Bar fraction={Math.min(ring.percent / 100, 1)} tone={ring.percent >= 100 ? "bg-emerald-600" : "bg-sky-600"} />}
            <p className="mt-1 text-sm font-semibold">{ring.code} {ring.name}</p>
            {ring.percent !== null && ring.target !== null ? <p className={`text-xs ${ring.verified ? "text-slate-500" : "text-amber-700"}`}>{shown} / {text.fmt(ring.target)}</p> : ring.isRate ? <p className="text-xs text-slate-500">{text.l.latest}</p> : null}
          </li>
        );
      })}
    </ul>
  ));
}

export function FunnelScreen(props: ScreenRendererPropsOf<typeof funnelModel>) {
  return readyOrNothing(props, (m, text) => {
    const max = Math.max(1, ...m.stages.map((s) => s.amount ?? 0));
    return (
      <div>
        <ol className="space-y-3 p-4">
          {m.stages.map((stage, i) => (
            <li key={i}>
              {stage.amount !== null ? <><p className="text-lg font-bold">{text.fmt(stage.amount)}</p><Bar fraction={stage.amount / max} /></> : <p className="text-sm italic text-slate-500">{text.l.notYetReported}</p>}
              <p className="flex justify-between text-xs text-slate-600"><span>{stage.label}</span>{stage.percentOfPrevious !== null && <span>{stage.percentOfPrevious}%</span>}</p>
            </li>
          ))}
        </ol>
        {m.sources.length > 0 && <p className="px-4 pb-2 text-xs text-slate-500">{text.l.source}: {m.sources.join("; ")}</p>}
      </div>
    );
  });
}
