import test from "node:test";
import assert from "node:assert/strict";
import { INDICATOR_VIEWS, indicatorViewSpec } from "../../src/features/logframe/domain/indicator-views.ts";
import { validateChartSpec } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";

test("every view of an indicator is a valid chart specification for that one indicator", () => {
  for (const v of INDICATOR_VIEWS.filter((x) => x !== "BY_GROUP")) {
    const spec = indicatorViewSpec(v, "ind-1");
    assert.ok(spec, v);
    assert.deepEqual(spec.dataset.indicatorIds, ["ind-1"]);
    assert.deepEqual(validateChartSpec(spec), [], `${v}: ${JSON.stringify(validateChartSpec(spec))}`);
  }
});

test("by place reads one level below the country; the table is a table kind", () => {
  assert.equal(indicatorViewSpec("BY_PLACE", "i")!.dataset.placeLevel, 1);
  assert.equal(indicatorViewSpec("TABLE", "i")!.kind, "PIVOT_TABLE");
});

test("the group view is a pie drawn from the recorded split, not a chart specification", () => {
  assert.equal(indicatorViewSpec("BY_GROUP", "i"), null);
  assert.ok(INDICATOR_VIEWS.includes("BY_GROUP"));
});
