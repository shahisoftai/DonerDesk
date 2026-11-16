import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("s5c");
page.setDefaultTimeout(10000);
for (const nm of ["Upper Dir", "Mardan"]) {
  await page.getByLabel("Search areas").fill(nm); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: new RegExp("^" + nm + "\\s*K\\.P\\.$") }).first().click().catch(e => console.log("click fail", e.message.split("\n")[0])); await page.waitForTimeout(1000);
  console.log(nm, await page.getByRole("button").allInnerTexts().then(a => a.filter(x => /tick|inside|look/i.test(x))));
}
await shot("s5c"); await browser.close();
