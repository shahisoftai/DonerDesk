import { attach, BASE } from "../lib.mjs";
const { page, shot, browser } = await attach("v58d");
page.setDefaultTimeout(60000);
const D = new URL("../inputs/", import.meta.url).pathname;
await page.goto(`${BASE}/projects/new/wizard`); await page.waitForSelector("h1"); await page.waitForTimeout(2500);
await page.getByText("Start a different project instead").click().catch(() => {}); await page.waitForTimeout(2500);
await page.waitForSelector("#pcw-file");
await page.locator("main select").first().selectOption({ label: "Nutrition" });
await page.locator("#pcw-file").setInputFiles(["workplan.csv"].map(f => D + f));
const t0 = Date.now();
await page.getByRole("button", { name: "Read my documents" }).click();
let err = null;
for (let i = 0; i < 80; i++) { await page.waitForTimeout(4000); const t = await page.locator("main").innerText(); if (/timed out|expired|could not be read/i.test(t)) { err = t.match(/.*(timed out|expired|could not be read).*/i)[0]; break; } if (!/Sending|Reading|being read|in progress/i.test(t) && i > 1) break; }
console.log("5 files:", err ? "FAIL " + err : "read ok", ((Date.now() - t0) / 1000).toFixed(0) + "s");
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Still to answer")).split("\n").filter(l => /waiting|results|indicators|planned|places/i.test(l)).slice(0, 6));
await page.getByRole("button", { name: /^6\. / }).first().click(); await page.waitForTimeout(1500);
const c = page.getByRole("button", { name: /^Confirm all \d+/ }).first(); if (await c.count()) { await c.click(); await page.waitForTimeout(6000); }
console.log("rows with Repeats badge:", await page.getByTestId("plan-repeats").count(), "| text:", await page.getByTestId("plan-repeats").first().innerText().catch(() => "-"));
await shot("v58d"); await browser.close();
