import { attach, BASE } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("tc1");
page.setDefaultTimeout(15000);
const pid = readFileSync(new URL("../pid.txt", import.meta.url), "utf8").trim();
await page.goto(`${BASE}/projects/${pid}/places`); await page.waitForTimeout(3000);
await page.getByText(/^To confirm/).first().click(); await page.waitForTimeout(2000);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("To confirm"), t.indexOf("To confirm") + 1500));
await shot("tc1"); await browser.close();
