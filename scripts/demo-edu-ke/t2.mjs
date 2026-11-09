import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("t2");
await page.selectOption("#org-type", { label: "International NGO" });
console.log(await page.getByRole("button").allInnerTexts().then(a=>a.join("|")));
await page.getByRole("button", { name: /save|continue|update/i }).last().click(); await page.waitForTimeout(4000);
console.log(page.url()); await page.screenshot({path:process.env.SHOT});
await browser.close(); process.exit(0);
