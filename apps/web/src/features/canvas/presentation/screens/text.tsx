import type { bannerModel, heroModel, keyMessagesModel, legendNotesModel, ScreenRendererPropsOf } from "./types";
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

import { iconById } from "@donordesk/domain/contexts/infographics/index.js";
import type { ToneName } from "@donordesk/domain/contexts/infographics/index.js";

const toneColour = (frame: PaintFrame, tone: ToneName): string => ({ ACCENT: frame.theme.accent, ACCENT2: frame.theme.accent2, MUTED: frame.theme.muted, WARN: frame.theme.warn, INK: frame.theme.ink, NONE: frame.theme.line })[tone];

/** A plain shape in a theme colour; decorative, so it is hidden from a screen reader unless it has a description. */
export function ShapeScreen({ model, frame }: { model: BlockModel<{ shape: string; tone: ToneName; label?: string }>; frame: PaintFrame }) {
  if (model.state !== "ready") return null;
  const { shape, tone, label } = model.model;
  const colour = toneColour(frame, tone);
  const fill = tone === "NONE" ? "none" : colour;
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true };
  return (
    <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-full w-full" {...a11y}>
      {shape === "LINE" && <line x1="0" y1="25" x2="100" y2="25" stroke={colour} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      {shape === "ARROW" && <><line x1="0" y1="25" x2="90" y2="25" stroke={colour} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" /><path d="M100 25 L88 17 L88 33 Z" fill={colour} /></>}
      {shape === "ELLIPSE" && <ellipse cx="50" cy="25" rx="49" ry="24" fill={fill} stroke={tone === "NONE" ? colour : "none"} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      {(shape === "RECTANGLE" || shape === "ROUNDED") && <rect x="1" y="1" width="98" height="48" rx={shape === "ROUNDED" ? 4 : 0} fill={fill} stroke={tone === "NONE" ? colour : "none"} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** One glyph from the product's icon set, in a theme colour. */
export function IconScreen({ model, frame }: { model: BlockModel<{ iconId: string; tone: ToneName; label?: string }>; frame: PaintFrame }) {
  if (model.state !== "ready") return null;
  const glyph = iconById(model.model.iconId);
  if (!glyph) return null;
  const a11y = model.model.label ? { role: "img" as const, "aria-label": model.model.label } : { "aria-hidden": true };
  return <svg viewBox="0 0 24 24" className="mx-auto h-full max-h-full w-full max-w-full" {...a11y}><path d={glyph.path} fill={toneColour(frame, model.model.tone === "NONE" ? "INK" : model.model.tone)} fillRule="evenodd" /></svg>;
}

export const DividerScreen = () => <hr className="my-3 border-slate-300 dark:border-slate-700" />;

export function BannerScreen(props: ScreenRendererPropsOf<typeof bannerModel>) {
  return readyOrNothing(props, (m) => <p className="rounded-lg bg-brand-700 px-4 py-4 text-center text-base font-bold text-white">{m.message}</p>);
}

export function KeyMessagesScreen(props: ScreenRendererPropsOf<typeof keyMessagesModel>) {
  return readyOrNothing(props, (m) => (
    <ol className="space-y-3 p-4">
      {m.messages.map((msg, i) => (
        <li key={i} className="flex gap-3 text-sm"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">{i + 1}</span><span>{msg.text}</span></li>
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

/** The cover: who funds it and where, the title, and a subtitle, over the design's picture when one can be loaded. */
export function HeroScreen(props: ScreenRendererPropsOf<typeof heroModel>) {
  return readyOrNothing(props, (m) => {
    const picture = m.assetId ? props.assetUrl?.(m.assetId) : undefined;
    return (
      <header className="relative overflow-hidden rounded-xl bg-brand-700 px-6 py-6 text-white" style={picture ? { backgroundImage: `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)), url(${picture})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        {m.kicker && <p className="text-xs font-semibold uppercase tracking-widest opacity-90">{m.kicker}</p>}
        <h2 className="mt-1 text-3xl font-bold leading-tight">{m.title}</h2>
        {m.subtitle && <p className="mt-2 text-sm opacity-95">{m.subtitle}</p>}
      </header>
    );
  });
}
