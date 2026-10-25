/**
 * Infographic themes (Phase 32.0): every colour, the font and the corner radius a design is drawn
 * with, as one token table. The Studio preview and the export composer read the same tokens, so a
 * theme can never look different on screen and on paper.
 *
 * `DEFAULT` is the look every Phase 31 design was made with, byte for byte: a saved design without
 * a `themeId` is read as `DEFAULT`, so nothing already published or saved changes appearance.
 *
 * Themes are plain data and have no agency names or marks: they follow conventions that
 * humanitarian products share (restrained palette, sans-serif, strong ink on white), not any
 * agency's identity.
 */

export type InfographicThemeId = "DEFAULT" | "HUMANITARIAN_BLUE" | "CYAN" | "HIGH_CONTRAST" | "PRINT_MONO";

export const INFOGRAPHIC_THEME_IDS: readonly InfographicThemeId[] = ["DEFAULT", "HUMANITARIAN_BLUE", "CYAN", "HIGH_CONTRAST", "PRINT_MONO"];

export interface InfographicTheme {
  /** `BRAND` is derived from an organization's brand kit (see brand.ts); the rest are in the registry. */
  id: InfographicThemeId | "BRAND";
  label: string;
  description: string;
  /** CSS font stack; the export machine must have a matching face (bundled fonts arrive in 32.1). */
  font: string;
  /** Page background. */
  page: string;
  /** Panel (card) fill and outline. */
  card: string;
  cardStroke: string;
  /** Tinted fill for inner cards and text panels. */
  surface: string;
  /** Strong text, body text, secondary text, placeholder text. */
  ink: string;
  body: string;
  muted: string;
  subtle: string;
  /** Rules and table lines. */
  line: string;
  /** Brand colour: section headings, header rule, primary bars. */
  accent: string;
  /** Pale tint of the accent (badges). */
  accentSoft: string;
  /** Second data colour (reach bars). */
  accent2: string;
  /** Caution text ("not verified", notes under a chart). */
  warn: string;
  /** Map panel. */
  mapWater: string;
  mapWaterStroke: string;
  mapLabel: string;
  mapNote: string;
  /** Delivery signal pins; one exhaustive table, same keys as `DeliverySignal`. */
  signals: Readonly<Record<"ON_TIME" | "LATE" | "DONE" | "CANCELLED", string>>;
  /** Categorical series colours for charts and legends, in order of use (colour-blind safe where marked by the theme). */
  palette: readonly string[];
  /** Corner radius of panels, px at 1240 wide. */
  radius: number;
  /** Section headings: ALL CAPS (the Phase 31 look) or sentence case (coordination-snapshot convention). */
  headingCase: "UPPER" | "SENTENCE";
}

const OKABE_ITO = ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442", "#000000"] as const;

export const INFOGRAPHIC_THEMES: Readonly<Record<InfographicThemeId, InfographicTheme>> = {
  DEFAULT: {
    id: "DEFAULT",
    label: "Classic blue",
    description: "The original look: white page, blue accent.",
    font: "Helvetica, Arial, sans-serif",
    page: "#ffffff",
    card: "#ffffff",
    cardStroke: "#e5e7eb",
    surface: "#f8fafc",
    ink: "#111827",
    body: "#374151",
    muted: "#6b7280",
    subtle: "#9ca3af",
    line: "#e5e7eb",
    accent: "#2f7be8",
    accentSoft: "#eef4fd",
    accent2: "#8b5cf6",
    warn: "#92400e",
    mapWater: "#eaf2fb",
    mapWaterStroke: "#d7e4f5",
    mapLabel: "#334155",
    mapNote: "#64748b",
    signals: { ON_TIME: "#16a34a", LATE: "#dc2626", DONE: "#2563eb", CANCELLED: "#94a3b8" },
    palette: ["#2f7be8", "#8b5cf6", "#16a34a", "#f59e0b", "#dc2626", "#0891b2", "#db2777", "#64748b"],
    radius: 10,
    headingCase: "UPPER",
  },
  HUMANITARIAN_BLUE: {
    id: "HUMANITARIAN_BLUE",
    label: "Humanitarian blue",
    description: "Arial, one strong blue and plenty of white, in the manner of coordination snapshots.",
    font: "Arial, Helvetica, sans-serif",
    page: "#ffffff",
    card: "#ffffff",
    cardStroke: "#d5dde8",
    surface: "#f3f6fa",
    ink: "#1a1a1a",
    body: "#333f4d",
    muted: "#55606e",
    subtle: "#6b7686",
    line: "#d5dde8",
    accent: "#0b66b3",
    accentSoft: "#e6f0fa",
    accent2: "#5b6b7f",
    warn: "#8a3b00",
    mapWater: "#eef3f8",
    mapWaterStroke: "#d5dde8",
    mapLabel: "#333f4d",
    mapNote: "#55606e",
    signals: { ON_TIME: "#2e7d32", LATE: "#c62828", DONE: "#0b66b3", CANCELLED: "#7a8696" },
    palette: ["#0b66b3", "#e07b00", "#2e7d32", "#7b4fa3", "#c62828", "#00838f", "#5b6b7f", "#a67c00"],
    radius: 4,
    headingCase: "SENTENCE",
  },
  CYAN: {
    id: "CYAN",
    label: "Cyan",
    description: "A bright cyan accent with dark text, for child-focused and public-facing pieces.",
    font: "Arial, Helvetica, sans-serif",
    page: "#ffffff",
    card: "#ffffff",
    cardStroke: "#cfe3ee",
    surface: "#f0f8fc",
    ink: "#12202b",
    body: "#2c3e4c",
    muted: "#4f6272",
    subtle: "#637587",
    line: "#cfe3ee",
    accent: "#0a73a3",
    accentSoft: "#e3f3fa",
    accent2: "#7a4a9e",
    warn: "#8a3b00",
    mapWater: "#e8f4fa",
    mapWaterStroke: "#cfe3ee",
    mapLabel: "#2c3e4c",
    mapNote: "#4f6272",
    signals: { ON_TIME: "#2e7d32", LATE: "#c62828", DONE: "#0a73a3", CANCELLED: "#7b8794" },
    palette: ["#0a73a3", "#f59e0b", "#2e7d32", "#7a4a9e", "#c62828", "#1cabe2", "#d6336c", "#5f6c7b"],
    radius: 12,
    headingCase: "SENTENCE",
  },
  HIGH_CONTRAST: {
    id: "HIGH_CONTRAST",
    label: "High contrast",
    description: "Maximum contrast and a colour-blind-safe palette, for projection and low-vision readers.",
    font: "Arial, Helvetica, sans-serif",
    page: "#ffffff",
    card: "#ffffff",
    cardStroke: "#000000",
    surface: "#f2f2f2",
    ink: "#000000",
    body: "#1a1a1a",
    muted: "#404040",
    subtle: "#4d4d4d",
    line: "#8c8c8c",
    accent: "#00457a",
    accentSoft: "#e0ecf7",
    accent2: "#7a3b00",
    warn: "#7a2e00",
    mapWater: "#f2f2f2",
    mapWaterStroke: "#000000",
    mapLabel: "#000000",
    mapNote: "#404040",
    signals: { ON_TIME: "#006b3c", LATE: "#b30000", DONE: "#00457a", CANCELLED: "#595959" },
    palette: OKABE_ITO,
    radius: 2,
    headingCase: "SENTENCE",
  },
  PRINT_MONO: {
    id: "PRINT_MONO",
    label: "Print (greyscale-safe)",
    description: "Shades that stay distinct in black-and-white print and photocopies.",
    font: "Arial, Helvetica, sans-serif",
    page: "#ffffff",
    card: "#ffffff",
    cardStroke: "#999999",
    surface: "#f4f4f4",
    ink: "#000000",
    body: "#262626",
    muted: "#4d4d4d",
    subtle: "#5c5c5c",
    line: "#bfbfbf",
    accent: "#1f1f1f",
    accentSoft: "#ececec",
    accent2: "#6e6e6e",
    warn: "#333333",
    mapWater: "#f4f4f4",
    mapWaterStroke: "#bfbfbf",
    mapLabel: "#1a1a1a",
    mapNote: "#4d4d4d",
    signals: { ON_TIME: "#4d4d4d", LATE: "#000000", DONE: "#808080", CANCELLED: "#bfbfbf" },
    palette: ["#000000", "#6e6e6e", "#a6a6a6", "#d0d0d0", "#3a3a3a", "#8c8c8c", "#bdbdbd", "#575757"],
    radius: 0,
    headingCase: "SENTENCE",
  },
};

export const INFOGRAPHIC_THEME_ORDER: readonly InfographicThemeId[] = INFOGRAPHIC_THEME_IDS;

export function themeById(id: string | undefined): InfographicTheme | undefined {
  if (!id) return undefined;
  return (INFOGRAPHIC_THEMES as Readonly<Record<string, InfographicTheme | undefined>>)[id];
}

/** The theme a design is drawn with: its own, or `DEFAULT` for a design saved before themes existed. A `BRAND` design needs the organization's derived theme, supplied by the caller. */
export function resolveTheme(id: string | undefined, brandTheme?: InfographicTheme): InfographicTheme {
  if (id === "BRAND" && brandTheme) return brandTheme;
  return themeById(id) ?? INFOGRAPHIC_THEMES.DEFAULT;
}

const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio (1–21) between two `#rrggbb` colours. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
