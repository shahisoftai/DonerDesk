// Bundles the real PhotosMapPanel, OverlayPanel and file converters; only the server actions, the router and the ECharts figure are stubbed.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEsbuild } from "../esbuild-loader.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");

export async function build(outfile) {
  const esbuild = await loadEsbuild();
  await esbuild.build({
    entryPoints: [join(here, "main.tsx")],
    bundle: true, outfile, format: "iife", jsx: "automatic", platform: "browser", absWorkingDir: web, nodePaths: [join(web, "node_modules")],
    alias: { "@/lib/actions/org": join(here, "../maps-v2/stubs/actions-org.ts"),
      "@/lib/actions/map-overlays": join(here, "stubs/actions-map-overlays.ts"),
      "@/features/workplan/presentation/SiteMapFigure": join(here, "stubs/SiteMapFigure.tsx"),
      "next/link": join(here, "stubs/link.tsx"),
      "@": join(web, "src"),
    },
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_MAP_ENGINE": '"echarts"' }, logLevel: "error",
  });
}
