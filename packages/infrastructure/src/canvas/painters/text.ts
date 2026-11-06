/** Text, divider, banner, key messages and notes, painted from their models (Phase 45.2). */
import type { ModelOf } from "@donordesk/domain";
import { bannerModel, keyMessagesModel, legendNotesModel } from "@donordesk/domain";
import { framed, icon, notReported, onColor, paragraph, previewHint, r, text, wrapText } from "../../infographics/kit.js";
import type { Slot } from "../../infographics/kit.js";
import type { PrintPainter } from "../print-types.js";

/** The text block's model is small enough to type here: its words and how they are set. */
export const paintText: PrintPainter<{ text?: string }> = ({ model, ctx: c, title, width }) => {
  const words = model.state === "ready" ? model.model.text ?? "" : "";
  const size = 12.5 * c.s;
  const para = paragraph(c, 16 * c.s, 14 * c.s, words, width - 32 * c.s, { size, maxLines: 16, fill: c.t.body, lineHeight: size * 1.45 });
  return framed(c, title, width, Math.max(56 * c.s, 30 * c.s + para.height), para.svg, c.t.surface);
};

export const paintDivider: PrintPainter<unknown> = ({ ctx: c, width }): Slot => ({
  svg: `<line x1="0" y1="${r(10 * c.s)}" x2="${r(width)}" y2="${r(10 * c.s)}" stroke="${c.t.line}" stroke-width="${r(1.5 * c.s)}"/>`, width, height: 22 * c.s,
});

type Banner = ModelOf<typeof bannerModel>;
export const paintBanner: PrintPainter<Banner> = ({ model, ctx: c, width }) => {
  if (model.state !== "ready") return previewHint(c, undefined, width, "Add a line of text");
  const msg = model.model.message;
  const { t, s } = c;
  const h = 56 * s;
  return { svg: `<rect x="0" y="0" width="${r(width)}" height="${r(h)}" rx="${t.radius}" fill="${t.accent}"/>${text(c, width / 2, h / 2 + 6 * s, wrapText(msg, width - 40 * s, 16 * s, 1, true)[0] ?? msg, { size: 16 * s, bold: true, fill: onColor(c, t.accent), anchor: "middle" })}`, width, height: h + 18 * s };
};

type Messages = ModelOf<typeof keyMessagesModel>;
export const paintKeyMessages: PrintPainter<Messages> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return previewHint(c, title, width, "Add three to five key messages");
  const { t, s } = c;
  const size = 13 * s;
  const textW = width - 32 * s - 40 * s;
  let y = 14 * s;
  let body = "";
  model.model.messages.forEach((m, i) => {
    const lines = wrapText(m.text, textW, size, 3);
    const h = Math.max(34 * s, lines.length * size * 1.4 + 12 * s);
    body += `<circle cx="${r(32 * s)}" cy="${r(y + 17 * s)}" r="${r(15 * s)}" fill="${t.accentSoft}"/>`;
    body += m.iconId ? icon(c, m.iconId, 20 * s, y + 5 * s, 24 * s, t.accent) : text(c, 32 * s, y + 22 * s, String(i + 1), { size: 14 * s, bold: true, fill: t.accent, anchor: "middle" });
    lines.forEach((line, li) => (body += text(c, 60 * s, y + 13 * s + size * 0.4 + li * size * 1.4, line, { size, fill: t.body })));
    y += h + 4 * s;
  });
  return framed(c, title, width, y + 10 * s, body);
};

type Notes = ModelOf<typeof legendNotesModel>;
const FROM = { fr: "dossiers du projet", es: "registros del proyecto" } as const;
export const paintLegendNotes: PrintPainter<Notes> = ({ model, ctx: c, title, width }) => {
  if (model.state !== "ready") return notReported(c, title, width);
  const { notes, source } = model.model;
  const { t, s } = c;
  const range = (x: { first: string; last: string; count: number }): string => `${x.first}${x.count > 1 ? ` – ${x.last}` : ""}`;
  const origin = `${c.l.source}: ${FROM[c.lang as keyof typeof FROM] ?? "project records"}`;
  const lines = [...notes, [origin, source?.periods ? range(source.periods) : "", source?.indicators ? `${c.l.indicators} ${range(source.indicators)}` : ""].filter(Boolean).join(" · ")];
  const size = 10.5 * s;
  let y = 12 * s;
  let body = "";
  for (const line of lines) {
    const p = paragraph(c, 16 * s, y, line, width - 32 * s, { size, maxLines: 3, fill: t.muted });
    body += p.svg;
    y += p.height + 4 * s;
  }
  return framed(c, title, width, y + 10 * s, body, t.surface);
};
