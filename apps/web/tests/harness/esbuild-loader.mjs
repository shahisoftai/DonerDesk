// Finds esbuild for the browser harnesses: a normal import when it is installed, else the copy in the pnpm store (it ships with several
// of this repo's dev tools but is not a declared dependency of this package; there is no network to add it).
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../..");

export async function loadEsbuild() {
  const require = createRequire(import.meta.url);
  try { return require("esbuild"); } catch { /* look in the pnpm store below */ }
  const store = resolve(web, "../../node_modules/.pnpm");
  const found = readdirSync(store).find((d) => d.startsWith("esbuild@"));
  if (!found) throw new Error("esbuild is not installed (it ships with several of this repo's dev tools); run pnpm install.");
  return require(join(store, found, "node_modules/esbuild"));
}

