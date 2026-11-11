/**
 * What a renderer needs from a block's formatting (Phase 50.2): colours resolved through the theme, sizes in px. The screen and the
 * print painter both read these hints, so a file and the screen draw the same frame, accent bar and title.
 */
import type { InfographicTheme } from "../../infographics/theme.js";
import type { BlockFormat, ColourChoice, ColourRole, Side } from "./types.js";

/** Semantic colours a theme may name for itself (Phase 50.5); without them the delivery-signal colours stand in. */
export interface SemanticColours { good: string; bad: string; neutral: string }
export type ThemeWithSemantics = InfographicTheme & { semantic?: SemanticColours | undefined };

export function roleColour(theme: ThemeWithSemantics, role: ColourRole): string {
  const viz = /^viz([1-8])$/.exec(role);
  if (viz) return theme.palette[(Number(viz[1]) - 1) % Math.max(1, theme.palette.length)] ?? theme.accent;
  switch (role) {
    case "good": return theme.semantic?.good ?? theme.signals.DONE;
    case "bad": return theme.semantic?.bad ?? theme.signals.LATE;
    case "neutral": return theme.semantic?.neutral ?? theme.muted;
    case "accent": return theme.accent;
    case "accent2": return theme.accent2;
    case "warn": return theme.warn;
    case "ink": return theme.ink;
    case "body": return theme.body;
    default: return theme.muted;
  }
}

export const colourOf = (theme: ThemeWithSemantics, c: ColourChoice): string => ("hex" in c ? c.hex : roleColour(theme, c.role));

export interface FormatHints {
  title: { show: boolean; subtitle: string | null; sizePx: number; bold: boolean; colour: string; align: "start" | "center" | "end"; rule: boolean };
  accentBar: { side: Side; px: number; colour: string } | null;
  border: { side: "all" | Side; px: number; colour: string } | null;
  padding: { top: number; end: number; bottom: number; start: number } | null;
}

const TITLE_PX = { S: 12, M: 14, L: 18, XL: 22 } as const;

export function formatHints(format: BlockFormat | undefined, theme: ThemeWithSemantics): FormatHints {
  const t = format?.title ?? {};
  const a = format?.accentBar;
  const f = format?.frame;
  return {
    title: { show: t.show ?? true, subtitle: t.subtitle?.trim() || null, sizePx: TITLE_PX[t.size ?? "M"], bold: (t.weight ?? "bold") === "bold", colour: t.color ? colourOf(theme, t.color) : theme.ink, align: t.align ?? "start", rule: t.rule ?? false },
    accentBar: a?.show ? { side: a.side ?? "start", px: a.thickness ?? 6, colour: colourOf(theme, a.color ?? { role: "accent" }) } : null,
    border: f?.borderSide ? { side: f.borderSide, px: f.borderWidth ?? 1, colour: f.borderColor ? colourOf(theme, f.borderColor) : theme.cardStroke } : null,
    padding: f?.padding ?? null,
  };
}
