/**
 * The chart library's theme for a colour mode (Phase 39.1). Built from the data-surface tokens and the domain's colour roles, so a
 * chart's text, rules and tooltip follow the same table as the tiles around it. Pure: no DOM, no chart library import; the screen
 * registers the returned object. Colours are concrete `#rrggbb` values because a canvas cannot read CSS variables.
 */
import { ROLES_BY_MODE, type ThemeRoleMap } from "@donordesk/domain/contexts/reporting/chart-theme-roles.js";
import { VIZ_TOKENS, tokenColor, type ThemeMode } from "./tokens.ts";

export const CHART_FONT_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Arabic', sans-serif";

/** Motion, one table: the picture draws in once; later data updates and refreshes never replay it; reduced motion has none. */
export const MOTION = { first: 300, update: 0, reduced: 0 } as const;

export const chartThemeName = (mode: ThemeMode): string => `donordesk-${mode}`;
export const rolesFor = (mode: ThemeMode): ThemeRoleMap => ROLES_BY_MODE[mode];

export function chartTheme(mode: ThemeMode): Record<string, unknown> {
  const roles = rolesFor(mode);
  const tile = (name: string): string => tokenColor(name, mode);
  const axis = {
    axisLine: { show: false }, axisTick: { show: false },
    axisLabel: { color: roles.muted, fontSize: 12 },
    splitLine: { show: true, lineStyle: { color: tile("tile-border"), type: "dashed" } },
    nameTextStyle: { color: roles.muted },
  };
  return {
    color: VIZ_TOKENS.map((t) => tile(t)),
    backgroundColor: "transparent",
    animationDuration: MOTION.first,
    animationDurationUpdate: MOTION.update,
    textStyle: { color: roles.text, fontFamily: CHART_FONT_STACK },
    title: { textStyle: { color: roles.text, fontWeight: 600 }, subtextStyle: { color: roles.muted } },
    legend: { textStyle: { color: roles.muted }, pageTextStyle: { color: roles.muted } },
    tooltip: { backgroundColor: tile("tile-bg"), borderColor: tile("tile-border"), borderWidth: 1, textStyle: { color: roles.text, fontSize: 12 }, extraCssText: "font-variant-numeric: tabular-nums;" },
    categoryAxis: { ...axis, splitLine: { show: false } },
    valueAxis: axis, logAxis: axis, timeAxis: axis,
    visualMap: { textStyle: { color: roles.muted } },
    // Labels default to an outlined white; on a dark tile that is a halo. They are plain text in the role colour.
    pie: { label: { color: roles.text, textBorderWidth: 0, textBorderColor: "transparent" }, labelLine: { lineStyle: { color: roles.muted } }, itemStyle: { borderColor: tile("tile-bg"), borderWidth: 2 } },
    bar: { label: { color: roles.text, textBorderWidth: 0, textBorderColor: "transparent" } },
    line: { label: { color: roles.text, textBorderWidth: 0, textBorderColor: "transparent" } },
  };
}
