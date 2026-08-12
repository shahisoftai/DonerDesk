import assert from "node:assert/strict";
import test from "node:test";
import { requireResidencyMatch } from "../dist/middleware/data-residency.js";

test("data residency permits default or matching writes", () => {
  assert.doesNotThrow(() => requireResidencyMatch("DEFAULT", "US"));
  assert.doesNotThrow(() => requireResidencyMatch("EU", "EU"));
});

test("data residency rejects cross-region writes", () => {
  assert.throws(
    () => requireResidencyMatch("EU", "US"),
    (error) => error?.code === "FORBIDDEN" && error?.details?.organizationRegion === "EU",
  );
});
