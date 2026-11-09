import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("ig2"); page.setDefaultTimeout(20000);
await page.getByRole("button", { name: "Use", exact: true }).first().click(); await page.waitForTimeout(9000);
console.log(page.url()); console.log((await page.locator("main").innerText()).slice(0,700));
console.log(await page.evaluate(() => [...document.querySelectorAll("main button, main a")].map(b=>b.innerText.trim().replace(/\n/g," ").slice(0,30)).filter(Boolean).slice(0,40).join(" | ")));
await page.screenshot({path:process.env.SHOT});
await browser.close(); process.exit(0);
