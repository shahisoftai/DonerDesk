// Bundles the real finance sections and the real sheet rules; only the server actions and the router are stubbed.
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
    alias: { "@/lib/actions/finance": join(here, "stubs/actions-finance.ts"), "next/navigation": join(here, "../entry-sheet/stubs/navigation.ts"), "@": join(web, "src") },
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
  });
}
