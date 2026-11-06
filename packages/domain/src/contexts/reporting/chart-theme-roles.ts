/**
 * Colour roles of a drawn chart (Phase 39.1). The chart builder never writes a bare colour for text, rules, ramps or signals: it names a
 * role, and the light map below is what a role means in a stored or exported picture. A screen that shows the chart in another mode
 * calls `retheme`, which swaps each light role value for the same role's value in that mode. Pure: no DOM, no chart library.
 */

export const THEME_ROLES = ["text", "muted", "surface", "emphasis", "rampStart", "mapArea", "mapAreaHover", "track", "positive", "negative", "neutral", "faint"] as const;
export type ThemeRole = (typeof THEME_ROLES)[number];
export type ThemeRoleMap = Readonly<Record<ThemeRole, string>>;

/** What a role is in every stored or exported picture (the values the builder always used). */
export const LIGHT_ROLES: ThemeRoleMap = {
  text: "#333333", muted: "#666666", surface: "#ffffff", emphasis: "#333333", rampStart: "#e0f2fe", mapArea: "#e7e5e4", mapAreaHover: "#d6d3d1",
  track: "rgba(150,150,150,0.25)", positive: "#059669", negative: "#dc2626", neutral: "#6b7280", faint: "#d1d5db",
};

/** The same roles on a dark surface; each is checked against the dark tile background by the design-token test. */
export const DARK_ROLES: ThemeRoleMap = {
  text: "#f1f5f9", muted: "#a3b5ad", surface: "#12231f", emphasis: "#f1f5f9", rampStart: "#1e3a4a", mapArea: "#2a3a35", mapAreaHover: "#3a4d46",
  track: "rgba(200,210,205,0.22)", positive: "#34d399", negative: "#f87171", neutral: "#9fb1a9", faint: "#4b5c55",
};

export const ROLES_BY_MODE = { light: LIGHT_ROLES, dark: DARK_ROLES } as const;

/** Light values that stand for more than one role are listed once, so a swap is unambiguous. `emphasis` shares `text`'s value on purpose. */
const SWAP_ROLES: ReadonlyArray<ThemeRole> = THEME_ROLES.filter((r) => r !== "emphasis");

const norm = (v: string): string => v.trim().toLowerCase().replace(/\s+/g, "");
const SHORT_FORMS: Readonly<Record<string, ThemeRole>> = { "#fff": "surface", "#333": "text", "#666": "muted" };

/**
 * Returns a copy of a chart option with every light role value replaced by `to`'s value for that role. A value that is not a role colour
 * (a person's own series colour, a palette colour) is left alone. `from` defaults to the light map. Nothing is mutated.
 */
export function retheme<T>(option: T, to: ThemeRoleMap, from: ThemeRoleMap = LIGHT_ROLES): T {
  if (to === from) return option;
  const swap = new Map<string, string>();
  for (const role of SWAP_ROLES) swap.set(norm(from[role]), to[role]);
  for (const [short, role] of Object.entries(SHORT_FORMS)) swap.set(short, to[role]);
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return swap.get(norm(v)) ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = walk(x);
      return out;
    }
    return v;
  };
  return walk(option) as T;
}

/**
 * A chart on a screen that already shows its title (a tile header) drops the title the builder draws inside the picture, and returns
 * the subtitle so the screen can show it as its own line. Exports and reports keep the embedded title: they call neither.
 */
export function splitEmbeddedTitle(option: Record<string, unknown>): { option: Record<string, unknown>; subtitle: string | undefined } {
  const title = option["title"];
  if (title === null || typeof title !== "object" || Array.isArray(title)) return { option, subtitle: undefined };
  const { subtext, ...rest } = title as Record<string, unknown>;
  void rest;
  const subtitle = typeof subtext === "string" && subtext.trim() !== "" ? subtext.trim() : undefined;
  const { title: _drop, ...others } = option;
  void _drop;
  return { option: others, subtitle };
}
