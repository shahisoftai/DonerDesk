// Bundles the real IndicatorEntryGrid for a browser, with only the server actions, router, outbox and comments stubbed.
import { dirname, join, resolve } from "node:path";
import { loadEsbuild } from "../esbuild-loader.mjs";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");

export async function build(outfile) {
  const esbuild = await loadEsbuild();
  await esbuild.build({
    entryPoints: [join(here, "main.tsx")],
    bundle: true, outfile, format: "iife", jsx: "automatic", platform: "browser",
    absWorkingDir: web, nodePaths: [join(web, "node_modules")],
    alias: {
      "@/lib/actions/indicators": join(here, "stubs/actions-indicators.ts"),
      "@/features/offline/presentation/OutboxProvider": join(here, "stubs/outbox.ts"),
      "@/features/comments/presentation/CommentsDisclosure": join(here, "stubs/comments.tsx"),
      "next/navigation": join(here, "stubs/navigation.ts"),
      "next/link": join(here, "stubs/link.tsx"),
      "@": join(web, "src"),
    },
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
  });
}
