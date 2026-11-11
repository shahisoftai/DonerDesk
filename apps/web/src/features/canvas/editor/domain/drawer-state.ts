/**
 * The two editor drawers' own settings (Phase 50.1): which are open, pinned or floating, how wide, which Edit tab, and whether every
 * section starts expanded. Kept on this device; read defensively, so a damaged or old value gives the defaults instead of breaking.
 */
export const EDIT_TABS = ["BUILD", "DATA", "FORMAT", "INTERACTIONS"] as const;
export type EditTab = (typeof EDIT_TABS)[number];
export interface DrawerPrefs { addOpen: boolean; editOpen: boolean; pinned: boolean; addWidth: number; editWidth: number; tab: EditTab; expandAll: boolean }

export const DRAWER_MIN = 240;
export const DRAWER_MAX = 560;
export const defaultDrawerPrefs = (viewportWidth: number): DrawerPrefs => ({ addOpen: false, editOpen: true, pinned: viewportWidth >= 1440, addWidth: 280, editWidth: 360, tab: "BUILD", expandAll: false });

const clampWidth = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, Math.round(v))) : d);

export function parseDrawerPrefs(raw: string | null | undefined, viewportWidth: number): DrawerPrefs {
  const d = defaultDrawerPrefs(viewportWidth);
  if (!raw) return d;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return d; }
  if (!o || typeof o !== "object") return d;
  const r = o as Record<string, unknown>;
  const bool = (k: string, def: boolean) => (typeof r[k] === "boolean" ? (r[k] as boolean) : def);
  return {
    addOpen: bool("addOpen", d.addOpen), editOpen: bool("editOpen", d.editOpen), pinned: bool("pinned", d.pinned), expandAll: bool("expandAll", d.expandAll),
    addWidth: clampWidth(r["addWidth"], d.addWidth), editWidth: clampWidth(r["editWidth"], d.editWidth),
    tab: (EDIT_TABS as readonly unknown[]).includes(r["tab"]) ? (r["tab"] as EditTab) : d.tab,
  };
}

/** How much room the pinned drawers take from the canvas; floating drawers take none. */
export const pinnedWidth = (p: DrawerPrefs): number => (p.pinned ? (p.addOpen ? p.addWidth : 0) + (p.editOpen ? p.editWidth : 0) : 0);
