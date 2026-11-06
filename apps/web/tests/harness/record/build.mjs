// Bundles the real Record sheet (its forms, rules and ports) for a browser check. Only the server actions and the outbox are stubbed:
// every `@/lib/actions/*` import becomes a function that records the call and answers as the scenario says.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEsbuild } from "../esbuild-loader.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");

/** Which names each action module is asked for anywhere in the source, so a stub exports exactly those. */
function actionNames() {
  const found = new Map();
  const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n)) scan(readFileSync(p, "utf8")); } };
  const scan = (text) => {
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/actions\/([\w-]+)"/g)) {
      const set = found.get(m[2]) ?? new Set();
      for (const part of m[1].split(",")) { const name = part.trim(); if (name && !name.startsWith("type ")) set.add(name.split(/\s+as\s+/)[0]); }
      found.set(m[2], set);
    }
  };
  walk(join(web, "src"));
  return found;
}

export async function build(outfile) {
  const esbuild = await loadEsbuild();
  const names = actionNames();
  const actionStubs = {
    name: "action-stubs",
    setup(b) {
      b.onResolve({ filter: /^@\/lib\/actions\// }, (a) => ({ path: a.path, namespace: "action-stub" }));
      b.onLoad({ filter: /.*/, namespace: "action-stub" }, (a) => {
        const mod = a.path.replace("@/lib/actions/", "");
        const exported = [...(names.get(mod) ?? [])];
        return { contents: exported.map((n) => `export const ${n} = (...args) => window.__call(${JSON.stringify(n)}, args);`).join("\n") + "\nexport {};", loader: "js" };
      });
    },
  };
  await esbuild.build({
    entryPoints: [join(here, "main.tsx")],
    bundle: true, outfile, format: "iife", jsx: "automatic", platform: "browser", absWorkingDir: web, nodePaths: [join(web, "node_modules")],
    plugins: [actionStubs],
    alias: {
      "@/features/offline/presentation/OutboxProvider": join(here, "stubs/outbox.tsx"),
      "next/navigation": join(here, "../entry-sheet/stubs/navigation.ts"),
      "next/link": join(here, "../entry-sheet/stubs/link.tsx"),
      "@": join(web, "src"),
    },
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
  });
}
