/**
 * How a block's frame looks (Phase 48.2): fill, border, corner radius, shadow and padding as named tokens, never raw colours or pixels.
 * A preset is a bundle of tokens; a block can pick a preset and override single tokens. `resolveFrame` turns tokens into concrete values
 * from the canvas theme, and the screen and the file painter both read its answer, so a frame looks the same in both.
 */
import type { CanvasBlockStyle } from "../canvas.js";
import type { InfographicTheme } from "../../infographics/theme.js";

export const FILL_TOKENS = ["none", "card", "tint", "accent"] as const;
export const BORDER_TOKENS = ["none", "line", "accent"] as const;
export const SPACE_TOKENS = ["none", "small", "medium", "large"] as const;
export const SHADOW_TOKENS = ["none", "small", "medium"] as const;

export interface FrameTokens { fill: (typeof FILL_TOKENS)[number]; border: (typeof BORDER_TOKENS)[number]; padding: (typeof SPACE_TOKENS)[number]; radius: (typeof SPACE_TOKENS)[number]; shadow: (typeof SHADOW_TOKENS)[number] }

export const FRAME_PRESETS: Readonly<Record<string, { label: string; tokens: FrameTokens }>> = {
  plain: { label: "Plain", tokens: { fill: "none", border: "none", padding: "none", radius: "none", shadow: "none" } },
  card: { label: "Card", tokens: { fill: "card", border: "line", padding: "medium", radius: "medium", shadow: "none" } },
  raised: { label: "Raised card", tokens: { fill: "card", border: "none", padding: "medium", radius: "medium", shadow: "medium" } },
  tint: { label: "Tinted panel", tokens: { fill: "tint", border: "none", padding: "medium", radius: "medium", shadow: "none" } },
  outline: { label: "Outline", tokens: { fill: "none", border: "line", padding: "medium", radius: "small", shadow: "none" } },
  accent: { label: "Accent panel", tokens: { fill: "accent", border: "none", padding: "large", radius: "medium", shadow: "none" } },
  accentLine: { label: "Accent outline", tokens: { fill: "none", border: "accent", padding: "medium", radius: "medium", shadow: "none" } },
  compact: { label: "Compact card", tokens: { fill: "card", border: "line", padding: "small", radius: "small", shadow: "none" } },
  roomy: { label: "Roomy card", tokens: { fill: "card", border: "line", padding: "large", radius: "large", shadow: "small" } },
  flat: { label: "Flat tint", tokens: { fill: "tint", border: "line", padding: "small", radius: "none", shadow: "none" } },
};

const SPACE_PX: Record<(typeof SPACE_TOKENS)[number], number> = { none: 0, small: 8, medium: 16, large: 24 };
const SHADOW_CSS: Record<(typeof SHADOW_TOKENS)[number], string> = { none: "none", small: "0 1px 2px rgba(15,23,42,0.12)", medium: "0 4px 12px rgba(15,23,42,0.16)" };

export interface ResolvedFrame { background: string | null; borderColour: string | null; paddingPx: number; radiusPx: number; shadow: string; /** Text colour that reads on this fill. */ text: string }

/** The tokens a block ends up with: its preset (or plain) with the block's own tokens laid over it. */
export function frameTokens(style: CanvasBlockStyle | undefined): FrameTokens {
  const base = (style?.frame && FRAME_PRESETS[style.frame]?.tokens) || FRAME_PRESETS["plain"]!.tokens;
  const fill = style?.background ?? base.fill;
  return { fill: fill as FrameTokens["fill"], border: style?.border ?? base.border, padding: style?.padding ?? base.padding, radius: style?.radius ?? base.radius, shadow: style?.shadow ?? base.shadow };
}

export function resolveFrame(style: CanvasBlockStyle | undefined, theme: InfographicTheme): ResolvedFrame {
  const t = frameTokens(style);
  const background = t.fill === "none" ? null : t.fill === "card" ? theme.card : t.fill === "tint" ? theme.surface : theme.accent;
  const onAccent = t.fill === "accent";
  return {
    background, borderColour: t.border === "none" ? null : t.border === "line" ? theme.cardStroke : theme.accent,
    paddingPx: SPACE_PX[t.padding], radiusPx: Math.round((theme.radius * ({ none: 0, small: 0.5, medium: 1, large: 1.6 })[t.radius])), shadow: SHADOW_CSS[t.shadow],
    text: onAccent ? pickText(theme.accent, theme) : theme.body,
  };
}

/** White or the theme's page colour, whichever reads better on the accent. */
function pickText(background: string, theme: InfographicTheme): string {
  const lum = (hex: string): number => { const n = parseInt(hex.slice(1), 16); const c = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255); };
  const ratio = (a: string, b: string): number => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  return ratio("#ffffff", background) >= ratio(theme.ink, background) ? "#ffffff" : theme.ink;
}

export function frameStyleProblems(style: CanvasBlockStyle | undefined): string[] {
  if (!style) return [];
  const out: string[] = [];
  if (style.frame !== undefined && !FRAME_PRESETS[style.frame]) out.push("That frame style is not one the product knows.");
  if (style.border !== undefined && !(BORDER_TOKENS as readonly string[]).includes(style.border)) out.push("Unknown border.");
  if (style.padding !== undefined && !(SPACE_TOKENS as readonly string[]).includes(style.padding)) out.push("Unknown padding.");
  if (style.radius !== undefined && !(SPACE_TOKENS as readonly string[]).includes(style.radius)) out.push("Unknown corner radius.");
  if (style.shadow !== undefined && !(SHADOW_TOKENS as readonly string[]).includes(style.shadow)) out.push("Unknown shadow.");
  return out;
}
