// Bundles the real HomeGrid, HomeLayoutEditor and layout rules; only the server actions and the router are stubbed, and the panel bodies are plain rows.
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
    alias: { "@/lib/actions/home-layout": join(here, "stubs/actions-home-layout.ts"), "next/navigation": join(here, "../entry-sheet/stubs/navigation.ts"), "next/link": join(here, "../entry-sheet/stubs/link.tsx"), "@": join(web, "src") },
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
  });
}
