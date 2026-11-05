// Bundles the real Project Creation Wizard (every slide, the real domain rules, the real view of the draft) for a real browser;
// only the server actions are stubbed (see stubs/). Node-only modules the domain root pulls in are replaced by stubs that fail loudly if used.
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
      "@/lib/actions/project-setup-draft": join(here, "stubs/actions.ts"),
      "@/lib/actions/project-setup": join(here, "stubs/item-actions.ts"),
      "@/lib/actions/org": join(here, "../maps-v2/stubs/actions-org.ts"),
      "next/navigation": join(here, "stubs/navigation.ts"),
      "next/link": join(here, "../entry-sheet/stubs/link.tsx"),
      "node:crypto": join(here, "stubs/node-only.ts"),
      "node:fs": join(here, "stubs/node-only.ts"),
      "node:path": join(here, "stubs/node-only.ts"),
      "@": join(web, "src"),
    },
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
  });
}
