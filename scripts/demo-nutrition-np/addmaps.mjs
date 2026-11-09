import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("addmaps");
const mapSel = page.getByLabel("Map", { exact: true }); console.log(await mapSel.locator("option").allInnerTexts());
const name = page.getByLabel("Name (optional)").last();
await mapSel.selectOption({ index: 0 }); await name.fill("Where we have results (by area)"); await page.getByRole("button", { name: "Add the map" }).click(); await page.waitForTimeout(3000);
await mapSel.selectOption({ index: 1 }); await name.fill("Where we work: activities by delivery state"); await page.getByRole("button", { name: "Add the map" }).click(); await page.waitForTimeout(3000);
await page.screenshot({ path: process.argv[2], fullPage: true });
await browser.close(); process.exit(0);
