import { attach, BASE } from "./lib.mjs"; import { readFileSync, appendFileSync, existsSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const { page, browser } = await attach();
const J = JSON.parse(readFileSync("acts.json", "utf8")); const MAN = JSON.parse(readFileSync("evidence-manifest.json", "utf8"));
const [from, to] = [Number(process.argv[2]), Number(process.argv[3])]; const limit = Number(process.argv[4] ?? 999);
const done = existsSync("ev-done.log") ? new Set(readFileSync("ev-done.log", "utf8").trim().split("\n")) : new Set();
let n = 0;
for (const e of MAN) {
  if (e.m < from || e.m > to || done.has(e.file) || n >= limit) continue;
  const act = J.acts.find(a => a.m === e.m && a.node === e.node); let title = act.title; if (e.m === 0 && e.node === "A2.2") title += " (revised)";
  await page.goto(`${BASE}/projects/${P}/evidence/new`); await page.waitForLoadState("networkidle");
  const sels = page.locator("main select");
  await sels.nth(0).selectOption({ label: e.type }); await sels.nth(1).selectOption({ label: e.sens });
  const texts = page.locator("main input[type=text]"); if (await texts.count()) await texts.first().fill(e.loc);
  await page.locator("main textarea").first().fill(e.notes);
  const aopts = await sels.nth(2).locator("option").allInnerTexts(); const a = aopts.find(o => o.trim() === title); if (!a) throw new Error("no activity option " + title);
  await sels.nth(2).selectOption({ label: a });
  const iopts = await sels.nth(3).locator("option").allInnerTexts(); const i = iopts.find(o => o.startsWith(e.ind + " —")); await sels.nth(3).selectOption({ label: i });
  await page.locator('input[type=file]').setInputFiles("files/" + e.file);
  const submit = page.getByRole("button", { name: /upload/i }).last(); await submit.click();
  await page.waitForFunction(() => !location.pathname.endsWith("/new"), null, { timeout: 60000 }).catch(() => console.log("  (stayed on form)"));
  await page.waitForTimeout(1500);
  const msg = (await page.locator("main").innerText()).split("\n").filter(l => /upload|fail|error|scan|queued|processing/i.test(l)).slice(0, 2).join(" | ");
  appendFileSync("ev-done.log", e.file + "\n"); n++; console.log(e.file.split("/").pop(), "->", page.url().replace(BASE, "").slice(-30), msg.slice(0, 120));
}
await browser.close(); process.exit(0);
