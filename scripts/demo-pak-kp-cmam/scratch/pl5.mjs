import { attach, BASE } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("pl5");
page.setDefaultTimeout(15000);
const pid = readFileSync(new URL("../pid.txt", import.meta.url), "utf8").trim();
await page.goto(`${BASE}/projects/${pid}/places`); await page.waitForTimeout(3000);
const c = page.getByLabel("Country", { exact: true }); if (!(await c.inputValue())) { await c.selectOption({ label: "Pakistan" }); await page.waitForTimeout(3000); }
for (const nm of ["Upper Dir", "Mardan"]) {
  await page.getByLabel("Search areas").fill(nm); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: new RegExp("^" + nm + "\\s*K\\.P\\.$") }).first().click(); await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Tick this area", exact: true }).click().catch(() => console.log("tick?")); await page.waitForTimeout(2500);
}
const t = await page.locator("main").innerText(); const i = t.indexOf("This project works in"); console.log(t.slice(i, i + 300));
await shot("pl5"); await page.getByRole("button", { name: /^Sites/ }).click(); await page.waitForTimeout(1500);
const u = await page.locator("main").innerText(); const k = u.indexOf("Sites"); console.log(u.slice(u.lastIndexOf("Sites"), u.lastIndexOf("Sites") + 1500));
await browser.close();
