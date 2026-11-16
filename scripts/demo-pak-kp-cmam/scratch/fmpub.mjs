import { attach, BASE } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, browser } = await attach("fmpub");
page.setDefaultTimeout(20000);
const pid = readFileSync(new URL("../pid.txt", import.meta.url), "utf8").trim();
await page.goto(`${BASE}/projects/${pid}/forms`); await page.waitForTimeout(3000);
const l = (await page.locator("main a[href*='/forms/']").evaluateAll(a => a.map(x => [x.innerText.split("\n")[0], x.href]))).filter(x => !/^OP|^OC|^New form/.test(x[0]));
console.log(l.length);
for (const [n, h] of l) { await page.goto(h); await page.waitForTimeout(2000); await page.getByRole("button", { name: "Publish", exact: true }).click(); await page.waitForTimeout(2500);
  const t = await page.locator("main").innerText(); console.log(n, "->", /Published|Open|collecting/i.test(t) ? "published" : t.slice(0, 120).replace(/\n/g, " ")); }
await browser.close();
