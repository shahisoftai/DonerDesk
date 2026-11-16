import { attach, BASE } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("mp1");
const pid = readFileSync(new URL("../pid.txt", import.meta.url), "utf8").trim();
await page.goto(`${BASE}/visuals/maps/${pid}`); await page.waitForTimeout(9000);
const t = await page.locator("main").innerText(); console.log(page.url()); console.log(t.slice(0, 1200));
await shot("map"); await browser.close();
