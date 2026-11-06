import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEsbuild } from "../esbuild-loader.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");

export async function build(outfile) {
  const esbuild = await loadEsbuild();
  await esbuild.build({
    entryPoints: [join(here, "main.tsx")], bundle: true, outfile, format: "iife", jsx: "automatic", platform: "browser", absWorkingDir: web, nodePaths: [join(web, "node_modules")],
    alias: { "@/lib/actions/org": join(here, "../maps-v2/stubs/actions-org.ts"), "@/lib/actions/map-overlays": join(here, "../dashboard-tiles/stubs/actions-map-overlays.ts"), "@/lib/actions/home-pins": join(here, "../dashboard-tiles/stubs/actions-home-pins.ts"), "@/lib/client/boundary-loader": join(here, "../dashboard-tiles/stubs/boundary-loader.ts"), "@/lib/actions/map-widgets": join(here, "../dashboard-tiles/stubs/actions-maps.ts"), "@/lib/actions/places": join(here, "../dashboard-tiles/stubs/actions-maps.ts"), "next/link": join(here, "../entry-sheet/stubs/link.tsx"), "@/lib/actions/dashboards": join(here, "stubs/actions-dashboards.ts"), "@/lib/actions/data-charts": join(here, "stubs/actions-data-charts.ts"), "next/navigation": join(here, "stubs/navigation.ts"), "@": join(web, "src") },
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_MAP_ENGINE": '"echarts"' }, logLevel: "error",
  });
}
