import test from "node:test";
import assert from "node:assert/strict";
import { OVERVIEW_SECTION_ORDER } from "../../src/features/projects/domain/overview-sections.ts";
import { OVERVIEW_PANEL_INFO, defaultOverviewLayout, overviewPanels, resolveOverviewLayout } from "../../src/features/projects/domain/overview-layout.ts";

test("every Overview part but Needs you can be arranged and has widths", () => {
  for (const s of OVERVIEW_SECTION_ORDER) {
    if (s === "NEEDS_YOU") continue;
    const info = OVERVIEW_PANEL_INFO[s];
    assert.ok(info, s);
    assert.ok(info.spans.includes(info.defaultSpan), s);
  }
  assert.equal(overviewPanels(["NEEDS_YOU", "PULSE"]).includes("NEEDS_YOU" as never), false);
});

test("a stored arrangement never reveals a part the role does not see", () => {
  const shown = ["NEEDS_YOU", "PULSE", "CALENDAR", "RISKS"] as const;
  const layout = resolveOverviewLayout([...shown], [{ key: "SETUP", span: 12, hidden: false }, { key: "RISKS", span: 6, hidden: false }, { key: "PULSE", span: 6, hidden: true }]);
  assert.deepEqual(layout.map((p) => p.key), ["RISKS", "PULSE", "CALENDAR"]);
  assert.equal(layout[0]!.span, 6);
  assert.equal(layout[1]!.span, 12, "Pulse offers only full width");
  assert.equal(layout[1]!.hidden, true);
});

test("nothing stored, or something unreadable, is the default order", () => {
  const shown = ["PULSE", "REPORTING", "TEAM"] as const;
  assert.deepEqual(resolveOverviewLayout([...shown], "nonsense"), defaultOverviewLayout([...shown]));
});
