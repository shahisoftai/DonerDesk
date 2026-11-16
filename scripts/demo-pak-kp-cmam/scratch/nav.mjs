import { attach, BASE } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("nav");
const pid = readFileSync(new URL("../pid.txt", import.meta.url), "utf8").trim();
await page.goto(`${BASE}/projects/${pid}`); await page.waitForTimeout(2500);
await page.getByRole("link", { name: "Work plan", exact: true }).first().click().catch(async () => { await page.getByRole("link", { name: "Plan", exact: true }).first().click(); await page.waitForTimeout(1500); await page.getByRole("link", { name: "Work plan", exact: true }).first().click(); });
await page.waitForTimeout(4000); console.log(page.url());
const t = await page.locator("main").innerText(); console.log(t.slice(0, 2200));
await shot("workplan"); await browser.close();
