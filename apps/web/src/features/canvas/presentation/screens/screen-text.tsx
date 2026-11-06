import type { ReactNode } from "react";
import { formatNumber, labelsFor, type InfographicLabels, type InfographicRounding } from "@donordesk/domain/contexts/infographics/index.js";
import type { BlockModel, PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";

/** The words and number format a screen renderer uses: the same ones the print painters use (`labelsFor`, `formatNumber`), so a block reads the same on screen and in a file. */
export interface ScreenText { l: InfographicLabels; fmt: (n: number, rounding?: InfographicRounding) => string }
export const screenText = (frame: PaintFrame): ScreenText => ({ l: labelsFor(frame.language), fmt: (n, rounding) => formatNumber(n, frame.language, rounding ?? "NONE") });

/** A block with nothing to show says so, with the reason; it never shows a placeholder figure. */
export function NothingToShow({ text, reason, authoring }: { text: ScreenText; reason: string; authoring?: boolean | undefined }) {
  // A block waiting for a person's words is a prompt ("Add a line of text."); one waiting for records is "not yet reported".
  if (authoring) return <div className="px-4 py-3 text-sm" data-state="prompt"><p className="italic text-slate-500">{reason}</p></div>;
  return (
    <div className="px-4 py-3 text-sm" data-state="nothing">
      <p className="italic text-slate-500">{text.l.notYetReported}</p>
      <p className="text-xs text-slate-500">{reason}</p>
    </div>
  );
}

export function Notes({ notes }: { notes: readonly string[] }) {
  return notes.length === 0 ? null : <ul className="px-4 pb-3 text-xs text-slate-500">{notes.map((n) => <li key={n}>{n}</li>)}</ul>;
}

/** Wraps a renderer: handles the empty and unavailable states and the notes once, so each block only draws its ready model. */
export function readyOrNothing<M>(props: { model: BlockModel<M>; frame: PaintFrame; assetUrl?: ((id: string) => string | undefined) | undefined }, draw: (model: M, text: ScreenText) => ReactNode): ReactNode {
  const text = screenText(props.frame);
  const m = props.model;
  if (m.state !== "ready") return <NothingToShow text={text} reason={m.reason} authoring={m.state === "empty" && m.authoring === true} />;
  return <>{draw(m.model, text)}<Notes notes={m.notes} /></>;
}

/** A bar whose number is in the text beside it; the bar itself is decoration. */
export function Bar({ fraction, tone = "bg-sky-600" }: { fraction: number; tone?: string }) {
  const pct = Math.max(2, Math.min(100, Math.round(fraction * 100)));
  return <span aria-hidden="true" className="block h-2 rounded bg-slate-100 dark:bg-slate-800"><span className={`block h-2 rounded ${tone}`} style={{ width: `${pct}%` }} /></span>;
}
