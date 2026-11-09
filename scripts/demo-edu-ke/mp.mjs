import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("mp"); page.setDefaultTimeout(15000);
await page.getByRole("button", { name: "Map", exact: true }).first().click(); await page.waitForTimeout(6000);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Map")).slice(0,900).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
