import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("cty2"); page.setDefaultTimeout(15000);
await page.getByLabel("Provinces or states").check(); await page.getByLabel("Districts", { exact: true }).check(); await page.waitForTimeout(800);
await page.getByRole("button", { name: "See what would be added" }).click(); await page.waitForTimeout(8000);
const t = await page.locator("main").innerText(); const i = t.indexOf("See what would be added"); console.log(t.slice(i, i+900).replace(/\n+/g," | "));
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map(b=>b.innerText.trim()).filter(x=>/^(add|apply|confirm)/i.test(x)).slice(0,8).join(" | ")));
await browser.close(); process.exit(0);
