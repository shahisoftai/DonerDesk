import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("cty4"); page.setDefaultTimeout(20000);
await page.getByRole("button", { name: "Add 272 places" }).click(); await page.waitForTimeout(15000);
const t = await page.locator("main").innerText(); console.log(t.match(/[^\n]*(added|Added|Saved|places)[^\n]*/g)?.slice(0,6));
console.log(t.slice(t.indexOf("Places to confirm")).slice(0,500).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
