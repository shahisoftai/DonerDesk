import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A server action that needs a session answers a visitor with a redirect to the login page, which cannot be caught and throws the whole
 * page away. A public page (a share link or an embed) must therefore never reach one. This test follows the imports of the public views
 * and fails if any file they use calls a signed-in action outside the places that are switched off for public pages.
 */
const SRC = join(import.meta.dirname, "../../src");
const read = (p: string) => readFileSync(p, "utf8");
const exists = (p: string) => { try { return statSync(p).isFile(); } catch { return false; } };

test("the map services built for a public page leave out every call that needs a session", () => {
  const composition = read(join(SRC, "features/maps/composition.ts"));
  assert.match(composition, /signedIn\?: boolean/);
  assert.match(composition, /options\.signedIn === false \? shipped/, "uploaded boundaries (a session-only action) are skipped on a public page");
  assert.match(composition, /signedIn: options\.signedIn !== false/);
});

test("both public views provide those services, and the map reads the flag before asking for the organisation's map settings", () => {
  for (const f of ["features/canvas/presentation/PublicCanvasView.tsx", "features/dashboards/presentation/PublicDashboard.tsx"]) {
    const text = read(join(SRC, f));
    assert.match(text, /publicMapServices\(\)/, `${f} gives its maps the public services`);
  }
  const results = read(join(SRC, "features/maps/presentation/ResultsMap.tsx"));
  assert.match(results, /useMapContext\(!staticData && services\.signedIn/, "map settings are read only for a signed-in page");
});

test("the signed-in actions the map code can reach are listed, so a new one is looked at", () => {
  // Each of these needs a session. Each is either off for a public page (flag above), or only on screens a signed-in person opens.
  const dirs = ["features/maps/presentation", "features/maps/adapters", "lib/client"];
  const seen = new Set<string>();
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n) && exists(p)) for (const m of read(p).matchAll(/import\s*\{([^}]*Action[^}]*)\}\s*from\s*"@\/lib\/actions\/([a-z-]+)"/g)) for (const a of m[1]!.split(",")) seen.add(`${m[2]}:${a.trim()}`); } };
  for (const d of dirs) walk(join(SRC, d));
  const known = new Set(["places:getPlaceResultsAction", "map-context:getMapContextAction", "map-context:saveMapContextAction", "map-overlays:addMapOverlayAction", "map-overlays:listMapOverlaysAction", "map-overlays:readMapOverlayAction", "map-overlays:removeMapOverlayAction", "place-flows:addPlaceFlowAction", "place-flows:removePlaceFlowAction", "map-analysis:populationWithinAction", "org:listBoundaryLayersAction", "org:uploadBoundaryLayerAction", "org:removeBoundaryLayerAction"]);
  const unknown = [...seen].filter((s) => !known.has(s));
  assert.deepEqual(unknown, [], `a map file calls a server action nobody has checked against public pages: ${unknown.join(", ")} (a public page must never reach an action that needs a session)`);
});
