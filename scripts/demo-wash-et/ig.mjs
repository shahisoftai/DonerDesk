import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("ig"); page.setDefaultTimeout(15000);
await page.getByRole("button", { name: "New infographic" }).click().catch(()=>page.getByRole("link", { name: "New infographic" }).click()); await page.waitForTimeout(3500);
console.log(page.url()); console.log((await page.locator("main").innerText()).slice(0,1800));
console.log(await page.evaluate(() => [...document.querySelectorAll("main button, main a")].map(b=>b.innerText.trim().replace(/\n/g," ").slice(0,40)).filter(Boolean).join(" | ")));
await page.screenshot({path:process.env.SHOT});
await browser.close(); process.exit(0);
