import { attach, BASE } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, browser } = await attach("st1");
const pid = readFileSync(new URL("../pid.txt", import.meta.url), "utf8").trim();
await page.goto(`${BASE}/projects/${pid}/places`); await page.waitForTimeout(3000);
await page.getByText(/^Sites \(/).first().click(); await page.waitForTimeout(2000);
const t = await page.locator("main").innerText(); const i = t.indexOf("Place\n"); console.log(t.slice(i - 300, i + 800));
await browser.close();
