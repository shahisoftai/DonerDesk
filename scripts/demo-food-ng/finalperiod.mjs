import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("finalperiod");
await page.getByText("Final", { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(1500);
await page.screenshot({ path: process.argv[2], fullPage: true });
console.log(await page.evaluate(() => [...document.querySelectorAll("main input,main select,main button")].map((e) => (e.getAttribute("name") || e.getAttribute("aria-label") || e.innerText || e.type).toString().slice(0, 40)).join(" | ")));
await browser.close(); process.exit(0);
