// Bundles the real field app (Today, My week, Waiting, Me, the form screen) for a browser check. Only the server actions and the outbox
// are stubbed; the phone's own storage (IndexedDB) is the browser's real one.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEsbuild } from "../esbuild-loader.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");

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
  const plugins = [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^@\/lib\/actions\// }, (a) => ({ path: a.path, namespace: "action-stub" }));
      b.onLoad({ filter: /.*/, namespace: "action-stub" }, (a) => {
        const mod = a.path.replace("@/lib/actions/", "");
        return { contents: [...(names.get(mod) ?? [])].map((n) => `export const ${n} = (...args) => window.__call(${JSON.stringify(n)}, args);`).join("\n") + "\nexport {};", loader: "js" };
      });
      // The outbox is the scenario's: any import of the real provider (by any path) gets the stand-in.
      b.onResolve({ filter: /(^|\/)OutboxProvider$/ }, () => ({ path: join(here, "outbox-stub.tsx") }));
    },
  }];
  await esbuild.build({
    entryPoints: [join(here, "main.tsx")],
    bundle: true, outfile, format: "iife", jsx: "automatic", platform: "browser", absWorkingDir: web, nodePaths: [join(web, "node_modules")], plugins,
    alias: { "next/navigation": join(here, "../entry-sheet/stubs/navigation.ts"), "next/link": join(here, "../entry-sheet/stubs/link.tsx"), "@": join(web, "src") },
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
  });
}
