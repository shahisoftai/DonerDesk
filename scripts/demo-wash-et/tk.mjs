import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("tk"); page.setDefaultTimeout(10000);
const c = page.getByLabel("Somali", { exact: true }); console.log(await c.count()); await c.first().check(); await page.waitForTimeout(2000);
console.log((await page.locator("body").innerText()).match(/\d to answer|Complete/g)?.join(","));
await browser.close(); process.exit(0);
