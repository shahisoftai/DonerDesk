import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("imp5");
page.setDefaultTimeout(60000);
const D = new URL("../inputs/", import.meta.url).pathname;
await page.locator("input[type=file]").first().setInputFiles(D + "workplan-dec.csv"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Create planned activities" }).click(); await page.waitForTimeout(12000);
const t = await page.locator("main").innerText(); const i = t.indexOf("Created"); console.log(i >= 0 ? t.slice(i, i + 600) : t.slice(t.indexOf("Or paste"), t.indexOf("Or paste") + 800));
await shot("imp5"); await browser.close();
