// A real-browser check of the slide-over panel: stacking (the lower panel steps back, the top one has Back and owns Esc) and the
// unsaved-changes question. The real Drawer; only next/link is stubbed.
//   pnpm --filter @donordesk/web test:drawer
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { loadEsbuild } from "../esbuild-loader.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const out = mkdtempSync(join(tmpdir(), "drawer-"));
const esbuild = await loadEsbuild();
await esbuild.build({
  entryPoints: [join(here, "main.tsx")], bundle: true, outfile: join(out, "bundle.js"), format: "iife", jsx: "automatic", platform: "browser",
  absWorkingDir: web, nodePaths: [join(web, "node_modules")], alias: { "next/link": join(here, "next-link-stub.tsx"), "@": join(web, "src") },
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
});
writeFileSync(join(out, "index.html"), '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n")[0]}`); } };
const dialog = (name) => page.getByRole("dialog", { name, includeHidden: true });
await page.goto(`file://${join(out, "index.html")}`);

await check("one panel: no Back button, Esc closes it", async () => {
  await page.getByText("Open A").click();
  await dialog("Panel A").waitFor();
  assert.equal(await dialog("Panel A").getByRole("button", { name: "Back" }).count(), 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("dialog").count(), 0);
});

await check("a second panel stacks: the lower one steps back (hidden from readers), the top one has Back", async () => {
  await page.getByText("Open A").click();
  await dialog("Panel A").waitFor();
  await page.getByText("Open B from A").click();
  await dialog("Panel B").waitFor();
  assert.equal(await dialog("Panel A").getAttribute("aria-hidden"), "true");
  assert.equal(await dialog("Panel B").getAttribute("aria-hidden"), null);
  assert.equal(await dialog("Panel B").getByRole("button", { name: "Back" }).count(), 1);
  assert.equal(await dialog("Panel A").getByRole("button", { name: "Back", includeHidden: true }).count(), 0);
});

await check("Esc closes only the top panel; the one below comes forward again", async () => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("dialog", { name: "Panel B" }).count(), 0);
  assert.equal(await dialog("Panel A").getAttribute("aria-hidden"), null);
});

await check("Back closes only its own panel", async () => {
  await page.getByText("Open B from A").click();
  await dialog("Panel B").waitFor();
  await dialog("Panel B").getByRole("button", { name: "Back" }).click();
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("dialog", { name: "Panel B" }).count(), 0);
  assert.equal(await page.getByRole("dialog", { name: "Panel A" }).count(), 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
});

await check("a panel with unsaved changes asks before it closes; Keep editing stays, Discard closes", async () => {
  await page.getByText("Open C").click();
  await dialog("Panel C").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("alertdialog").waitFor();
  await page.getByRole("button", { name: "Keep editing" }).click();
  assert.equal(await page.getByRole("dialog", { name: "Panel C" }).count(), 1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Discard" }).click();
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("dialog").count(), 0);
});

await browser.close();
console.log(results.join("\n"));
if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
if (results.some((r) => r.startsWith("FAIL")) || errors.length) process.exit(1);
