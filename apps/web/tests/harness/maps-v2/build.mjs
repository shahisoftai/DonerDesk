// Bundles the real MapExplorer, ResultsMap, renderer and adapters; only the signed-in results action and next/link are stubbed.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEsbuild } from "../esbuild-loader.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");

/** The stand-ins for server-only modules, shared by the test build and the production-style build used for the budgets. */
export function harnessAlias() {
  return {
    "@/lib/actions/places": join(here, "stubs/actions-places.ts"),
    "@/lib/actions/map-widgets": join(here, "stubs/actions-map-widgets.ts"),
    "@/lib/actions/org": join(here, "stubs/actions-org.ts"),
    "@/lib/actions/map-overlays": join(here, "../maps-extras/stubs/actions-map-overlays.ts"),
    "next/navigation": join(here, "stubs/navigation.ts"),
    "next/link": join(here, "../maps-extras/stubs/link.tsx"),
    "@": join(web, "src"),
  };
}
export const HARNESS_DEFINE = { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_MAP_ENGINE": '"maplibre"' };

export async function build(outfile) {
  const esbuild = await loadEsbuild();
  await esbuild.build({
    entryPoints: [join(here, "main.tsx")],
    bundle: true, outfile, format: "iife", jsx: "automatic", platform: "browser", absWorkingDir: web, nodePaths: [join(web, "node_modules")],
    loader: { ".css": "css", ".pbf": "empty" },
    alias: harnessAlias(),
    define: HARNESS_DEFINE, logLevel: "error",
  });
}
