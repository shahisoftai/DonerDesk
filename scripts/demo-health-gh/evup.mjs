import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, appendFileSync } from "node:fs"; import { MS } from "./plan7.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("evup");
const manifest = JSON.parse(readFileSync("evidence-manifest.json","utf8")); const m = Number(process.argv[2]); const yr = m < 3 ? 2025 : 2026;
const items = manifest.filter(x => x.m === m && (!process.env.ONLY || x.file.includes(process.env.ONLY))); let first = true;
for (const e of items) {
  await page.goto(`${BASE}/projects/${P}/evidence/new`); await page.waitForLoadState("networkidle");
  const sels = page.locator("main select"); // type, confidentiality, activity, indicator
  await sels.nth(0).selectOption({ label: e.type }); await sels.nth(1).selectOption({ label: e.sens });
  await page.locator("main input:not([type=file]):not([type=checkbox]):not([type=radio])").first().fill(e.loc);
  await page.locator("main textarea").first().fill(e.notes);
  const aopts = await sels.nth(2).locator("option").allInnerTexts();
  const ah = aopts.find(o => o.includes(` ${e.node} —`) && o.includes(`${MS[m]} ${yr} ·`)); if (!ah) throw new Error("no activity " + e.node + " " + MS[m]);
  await sels.nth(2).selectOption({ label: ah });
  if (e.ind) { const iopts = await sels.nth(3).locator("option").allInnerTexts(); const io = iopts.find(o => o.startsWith(e.ind + " —")); if (!io) throw new Error("no indicator " + e.ind); await sels.nth(3).selectOption({ label: io }); await page.waitForTimeout(400); }
  if (first) { console.log((await page.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 600)); first = false; }
  await page.locator("input[type=file]").setInputFiles(e.file);
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^(Upload|Save|Submit)/ }).last().click();
  await page.waitForFunction(() => !location.pathname.endsWith("/new"), null, { timeout: 60000 }).catch(() => console.log("  (no redirect)", e.file.split("/").pop()));
  await page.waitForTimeout(700); appendFileSync("ev.log", `${m}\t${e.node}\t${e.ind}\t${e.file.split("/").pop()}\t${page.url().split("/").pop()}\n`);
}
console.log("month", m + 1, "uploaded", items.length);
await browser.close(); process.exit(0);
