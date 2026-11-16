import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("w10");
page.setDefaultTimeout(8000);
const sel = page.locator("select").first();
console.log("selects", await page.locator("select").count(), "disabled", await sel.isDisabled(), await sel.getAttribute("id"), (await sel.locator("option").allInnerTexts()).slice(0, 3));
await page.getByText("Your documents", { exact: true }).click(); await page.waitForTimeout(800);
const t = await page.locator("main").innerText(); const i = t.indexOf("Your documents"); console.log(t.slice(i, i + 1400));
console.log("files", await page.locator("input[type=file]").count());
await shot("docs2"); await browser.close();
