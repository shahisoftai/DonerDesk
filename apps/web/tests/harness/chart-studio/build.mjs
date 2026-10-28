// Bundles the real ChartStudio (and the real chart builder) for a browser; only the server actions are stubbed.
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
    alias: { "@/lib/actions/charts": join(here, "stubs/actions-charts.ts"), "@/lib/actions/dashboards": join(here, "stubs/actions-dashboards.ts"), "@": join(web, "src") },
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
  });
}
