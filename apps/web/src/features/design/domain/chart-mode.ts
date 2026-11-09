/**
 * A chart option as a screen in a colour mode should draw it (Phase 47): the colour roles swapped for the mode, and the colours of a
 * theme preset fitted to the dark surface (a stored or exported picture always carries the light ones). A person's own series colours and
 * named palettes are left alone. Pure.
 */
import { retheme } from "@donordesk/domain/contexts/reporting/chart-theme-roles.js";
import { PRESET_PALETTE_PREFIX, presetColors } from "@donordesk/domain/contexts/reporting/chart-presets.js";
import { rolesFor } from "./chart-theme.ts";
import type { ThemeMode } from "./tokens.ts";

export function optionForMode(option: Record<string, unknown>, mode: ThemeMode, paletteId?: string | undefined): Record<string, unknown> {
  if (mode === "light") return option;
  const themed = retheme(option, rolesFor(mode));
  const id = paletteId?.startsWith(PRESET_PALETTE_PREFIX) ? paletteId.slice(PRESET_PALETTE_PREFIX.length) : undefined;
  const dark = id ? presetColors(id, "dark") : undefined;
  return dark && Array.isArray(themed["color"]) ? { ...themed, color: dark } : themed;
}
