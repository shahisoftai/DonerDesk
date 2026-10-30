import test from "node:test";
import assert from "node:assert/strict";
import { HOME_TILES, HOME_TILES_BY_VARIANT, showsTile } from "../../src/features/dashboard/domain/home-tiles.ts";

test("every Home variant has decided, and only about known parts", () => {
  assert.deepEqual(Object.keys(HOME_TILES_BY_VARIANT).sort(), ["COMPLIANCE", "DIRECTOR", "FIELD", "GRANTS", "MANAGER"]);
  for (const [variant, tiles] of Object.entries(HOME_TILES_BY_VARIANT)) for (const t of tiles) assert.ok((HOME_TILES as readonly string[]).includes(t), `${variant} names an unknown part ${t}`);
});

test("everyone keeps their own pins and bookmarks; grants and funding are for the roles that work with money", () => {
  for (const v of Object.keys(HOME_TILES_BY_VARIANT) as Array<keyof typeof HOME_TILES_BY_VARIANT>) { assert.ok(showsTile(v, "PINNED")); assert.ok(showsTile(v, "BOOKMARKS")); }
  assert.ok(showsTile("DIRECTOR", "GRANTS")); assert.ok(!showsTile("MANAGER", "GRANTS")); assert.ok(!showsTile("FIELD", "FUNDING"));
});
