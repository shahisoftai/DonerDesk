import { attach, BASE } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("look");
const pid = readFileSync(new URL("../pid.txt", import.meta.url), "utf8").trim();
const path = process.argv[2] || "";
await page.goto(`${BASE}/projects/${pid}${path}`); await page.waitForTimeout(4000);
const t = await page.locator("main").innerText(); console.log(page.url()); console.log(t.slice(0, +process.argv[3] || 2500));
await shot("look" + path.replace(/\W+/g, "-")); await browser.close();
