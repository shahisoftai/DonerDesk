// Bundles the real setup wizard (every slide, the real domain rules, the real four-language copy); only the server actions and the router are stubbed.
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
    alias: {
      "@/lib/actions/project-setup": join(here, "stubs/actions.ts"),
      "next/navigation": join(here, "stubs/navigation.ts"),
      "next/link": join(here, "../entry-sheet/stubs/link.tsx"),
      "@": join(web, "src"),
    },
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
  });
}
