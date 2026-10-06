import { attach, BASE } from "./lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const key = process.argv[2]; const id = key.length > 2 ? key : per[Number(key)];
const types = (process.argv[3] ?? "Word document,PDF report,Indicator spreadsheet,Evidence checklist").split(","); const tag = process.argv[4] ?? `m${Number(key) + 1}`;
const OUT = "/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/memorybank/demo/verification-demo-5-artifacts/reports/";
const { page, browser } = await attach();
for (const ty of types) {
  await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Export report" }).first().click(); await page.waitForTimeout(5000);
  const d = page.locator('[role=dialog]').first();
  const txt0 = await d.innerText(); if (/blocked/i.test(txt0)) { console.log(ty, "BLOCKED:", txt0.replace(/\n+/g, " | ").slice(0, 1200)); break; }
  await d.locator("select").first().selectOption({ label: ty }); await page.waitForTimeout(400);
  await d.getByRole("button", { name: /^Next/ }).click(); await page.waitForTimeout(1500);
  const nb = d.getByRole("button", { name: /Next: review/ }); if (await nb.count()) { await nb.click(); await page.waitForTimeout(1500); }
  const txt1 = await d.innerText(); if (!/No warnings/i.test(txt1)) console.log(ty, "REVIEW:", txt1.replace(/\n+/g, " | ").slice(0, 900));
  await d.getByRole("button", { name: /Create export/ }).click(); await page.waitForTimeout(10000);
  const a = d.locator("a", { hasText: "Download" }).first(); if (!(await a.count())) { console.log(ty, "no download", (await d.innerText()).replace(/\n+/g," | ").slice(0,500)); continue; }
  const href = await a.getAttribute("href"); const name = (href.match(/name=([^&]+)/)?.[1] ?? "export") ; const ext = name.split(".").pop();
  const r = await page.request.get(BASE + href); const buf = await r.body(); const fn = OUT + `${tag}-${ty.split(" ")[0].toLowerCase()}.${ext}`; writeFileSync(fn, buf); console.log(ty, r.status(), buf.length, "bytes ->", fn.split("/").pop());
}
await browser.close(); process.exit(0);
