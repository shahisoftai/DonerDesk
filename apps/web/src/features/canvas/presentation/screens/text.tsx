import type { bannerModel, keyMessagesModel, legendNotesModel, ScreenRendererPropsOf } from "./types";
import type { BlockModel, PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";
import { readyOrNothing, screenText } from "./screen-text";

/** Plain authored words. A line starting `# ` is a heading; a block with no words is simply blank (the editor shows its hint). */
export function TextScreen({ model }: { model: BlockModel<{ text?: string; role?: string }>; frame: PaintFrame }) {
  const words = model.state === "ready" ? model.model.text ?? "" : "";
  return (
    <div className="space-y-2 px-4 py-3 text-sm" data-state={words ? "ready" : "blank"}>
      {words.split("\n").map((line, i) => (line.startsWith("# ") ? <h3 key={i} className="text-lg font-bold">{line.slice(2)}</h3> : line.trim() ? <p key={i}>{line}</p> : null))}
    </div>
  );
}

export const DividerScreen = () => <hr className="my-3 border-slate-300 dark:border-slate-700" />;

export function BannerScreen(props: ScreenRendererPropsOf<typeof bannerModel>) {
  return readyOrNothing(props, (m) => <p className="rounded-lg bg-sky-700 px-4 py-4 text-center text-base font-bold text-white">{m.message}</p>);
}

export function KeyMessagesScreen(props: ScreenRendererPropsOf<typeof keyMessagesModel>) {
  return readyOrNothing(props, (m) => (
    <ol className="space-y-3 p-4">
      {m.messages.map((msg, i) => (
        <li key={i} className="flex gap-3 text-sm"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-800">{i + 1}</span><span>{msg.text}</span></li>
      ))}
    </ol>
  ));
}

const FROM = { fr: "dossiers du projet", es: "registros del proyecto" } as const;
export function LegendNotesScreen(props: ScreenRendererPropsOf<typeof legendNotesModel>) {
  return readyOrNothing(props, (m) => {
    const text = screenText(props.frame);
    const range = (x: { first: string; last: string; count: number }): string => `${x.first}${x.count > 1 ? ` – ${x.last}` : ""}`;
    const origin = `${text.l.source}: ${FROM[props.frame.language as keyof typeof FROM] ?? "project records"}`;
    const source = [origin, m.source?.periods ? range(m.source.periods) : "", m.source?.indicators ? `${text.l.indicators} ${range(m.source.indicators)}` : ""].filter(Boolean).join(" · ");
    return <ul className="space-y-1 px-4 py-3 text-xs text-slate-600">{[...m.notes, source].map((line, i) => <li key={i}>{line}</li>)}</ul>;
  });
}
