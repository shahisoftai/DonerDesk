import type { imageModel, quoteModel, sectorGridModel, threeWModel, timelineModel, ScreenRendererPropsOf } from "./types";
import { Bar, readyOrNothing } from "./screen-text";

export function QuoteScreen(props: ScreenRendererPropsOf<typeof quoteModel>) {
  return readyOrNothing(props, (q) => {
    const portrait = q.assetId ? props.assetUrl?.(q.assetId) : undefined;
    return (
      <figure className="flex gap-4 border-s-4 border-sky-600 p-4">
        {portrait && <img src={portrait} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />}
        <blockquote className="text-lg italic">“{q.text}”{q.attribution && <footer className="mt-2 text-xs font-bold not-italic text-slate-600">— {q.attribution}</footer>}</blockquote>
      </figure>
    );
  });
}

export function ImageScreen(props: ScreenRendererPropsOf<typeof imageModel>) {
  return readyOrNothing(props, (m, text) => {
    const url = props.assetUrl?.(m.assetId);
    const caption = [m.caption, m.credit ? `${text.l.photoCredit}: ${m.credit}` : ""].filter(Boolean).join(" · ");
    return (
      <figure className="p-3">
        {url ? <img src={url} alt={m.altText ?? ""} className={`w-full rounded-lg ${m.fit === "CONTAIN" ? "object-contain" : "object-cover"}`} /> : <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">{m.altText ?? m.caption ?? ""}</p>}
        {caption && <figcaption className="mt-1 text-xs text-slate-500">{caption}</figcaption>}
      </figure>
    );
  });
}

export function TimelineScreen(props: ScreenRendererPropsOf<typeof timelineModel>) {
  return readyOrNothing(props, (m) => (
    <ol className="space-y-3 border-s-2 border-slate-200 p-4 ps-6">
      {m.events.map((e, i) => <li key={i}><p className="text-xs font-bold text-slate-500">{e.date}</p><p className="text-sm font-bold">{e.label}</p>{e.detail && <p className="text-xs text-slate-600">{e.detail}</p>}</li>)}
    </ol>
  ));
}

export function SectorGridScreen(props: ScreenRendererPropsOf<typeof sectorGridModel>) {
  return readyOrNothing(props, (m, text) => (
    <ul className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {m.sectors.map((sector, i) => (
        <li key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <h4 className="font-bold">{sector.label}</h4>
          {sector.indicators.length === 0 && <p className="text-xs italic text-slate-500">{text.l.notYetReported}</p>}
          <ul className="mt-2 space-y-2">
            {sector.indicators.map((ind, k) => ind ? (
              <li key={k}>
                <p className="text-xs text-slate-500">{ind.name}</p>
                <p className={`text-lg font-bold ${ind.verified ? "" : "text-amber-700"}`}>{ind.amount !== null ? text.fmt(ind.amount) : ind.text}{ind.unit === "%" ? "%" : ""}</p>
                {ind.percent !== null && ind.target !== null && <><Bar fraction={Math.min(1, ind.percent / 100)} /><p className="text-xs text-slate-500">{Math.round(ind.percent)}% · {text.fmt(ind.target)}</p></>}
              </li>
            ) : <li key={k} className="text-xs italic text-slate-500">{text.l.notYetReported}</li>)}
          </ul>
        </li>
      ))}
    </ul>
  ));
}

export function ThreeWScreen(props: ScreenRendererPropsOf<typeof threeWModel>) {
  return readyOrNothing(props, (m, text) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-slate-500"><th className="px-3 py-1 text-start">{text.l.who}</th><th className="px-3 py-1 text-start">{text.l.what}</th>{m.places.map((p) => <th key={p.key} className="px-2 py-1 text-center">{p.name}</th>)}</tr></thead>
        <tbody>
          {m.rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className="px-3 py-1 text-start font-bold">{row.who}</th><td className="px-3 py-1">{row.what}</td>
              {m.places.map((p) => <td key={p.key} className="px-2 py-1 text-center">{row.placeKeys.includes(p.key) ? <span role="img" aria-label={p.name}>●</span> : null}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t text-xs font-bold text-slate-500"><td className="px-3 py-1">{m.partners} {text.l.partnersCount}</td><td />{m.places.map((p) => <td key={p.key} className="px-2 py-1 text-center">{p.count}</td>)}</tr></tfoot>
      </table>
      {m.source && <p className="px-3 pb-2 text-xs text-slate-500">{text.l.source}: {m.source}</p>}
    </div>
  ));
}
