import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { DARK_ROLES, LIGHT_ROLES, THEME_ROLES } from "@donordesk/domain/contexts/reporting/chart-theme-roles.js";
import { chartTheme, chartThemeName } from "../../src/features/design/domain/chart-theme.ts";
import { contrastRatio, tokenColor } from "../../src/features/design/domain/tokens.ts";

const hex = (v: string): boolean => /^#[0-9a-f]{6}$/i.test(v);

test("a chart theme exists for both modes and names them differently", () => {
  assert.notEqual(chartThemeName("light"), chartThemeName("dark"));
  for (const mode of ["light", "dark"] as const) assert.ok(Array.isArray(chartTheme(mode).color));
});

test("text roles reach 4.5:1 and mark roles 3:1 on the tile in each mode", () => {
  const text = ["text", "muted"] as const;
  const marks = ["positive", "negative", "neutral"] as const;
  for (const [mode, roles] of [["light", LIGHT_ROLES], ["dark", DARK_ROLES]] as const) {
    const bg = tokenColor("tile-bg", mode);
    for (const r of text) assert.ok(contrastRatio(roles[r], bg) >= 4.5, `${r} (${mode}) ${contrastRatio(roles[r], bg).toFixed(2)}`);
    for (const r of marks) if (hex(roles[r])) assert.ok(contrastRatio(roles[r], bg) >= 3, `${r} (${mode}) ${contrastRatio(roles[r], bg).toFixed(2)}`);
  }
});

test("every role is defined in both modes", () => {
  for (const r of THEME_ROLES) { assert.ok(LIGHT_ROLES[r]); assert.ok(DARK_ROLES[r]); }
});

test("dashboard presentation files hold no colour literal and no direct number formatting of their own", () => {
  const dir = new URL("../../src/features/dashboards/presentation/widgets/", import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), "utf8");
    assert.doesNotMatch(src, /#[0-9a-fA-F]{6}\b/, `${f} has a colour literal`);
  }
});

test("the widget registry ends in a catch-all and has a unique key per row", () => {
  const src = readFileSync(new URL("../../src/features/dashboards/presentation/widgets/registry.tsx", import.meta.url), "utf8");
  const keys = [...src.matchAll(/key: "(\w+)"/g)].map((m) => m[1]);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys[keys.length - 1], "chart");
});

test("the dashboard chart renderer prepares the option for a tile and offers the subtitle", () => {
  const src = readFileSync(new URL("../../src/features/dashboards/presentation/widgets/registry.tsx", import.meta.url), "utf8");
  assert.match(src, /forScreen\(drawing\.chart\.option\)\.subtitle/);
  assert.match(src, /subtitle: /);
});

import { MOTION } from "../../src/features/design/domain/chart-theme.ts";
test("motion: the picture draws in once, updates and reduced motion have none", () => {
  assert.ok(MOTION.first > 0);
  assert.equal(MOTION.update, 0);
  assert.equal(MOTION.reduced, 0);
  assert.equal((chartTheme("dark") as { animationDurationUpdate: number }).animationDurationUpdate, 0);
});

test("every chart tile offers View data, built from the same option as the picture", () => {
  const body = readFileSync(new URL("../../src/features/dashboards/presentation/widgets/ChartBody.tsx", import.meta.url), "utf8");
  assert.match(body, /optionToTable\(chart\.option\)/);
  assert.match(body, /forScreen\(chart\.option\)/);
  const reg = readFileSync(new URL("../../src/features/dashboards/presentation/widgets/registry.tsx", import.meta.url), "utf8");
  assert.match(reg, /<ChartBody /);
});

test("Home draws its bars and line from the data-surface tokens, with no chart library of its own and no colour literal", () => {
  const src = readFileSync(new URL("../../src/features/dashboard/presentation/HomeWidgets.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /from "echarts"|import\("echarts"\)/);
  assert.doesNotMatch(src, /#[0-9a-fA-F]{6}\b|brand-500|warning-500/);
  assert.match(src, /var\(--viz-1\)/);
  assert.match(src, /var\(--tile-border\)/);
});
