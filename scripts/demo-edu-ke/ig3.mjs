import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("ig3"); page.setDefaultTimeout(20000);
await page.goto(`${BASE}/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/infographics`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
await page.getByRole("button", { name: "New infographic" }).click().catch(()=>{}); await page.waitForTimeout(1500); await page.locator("button", { hasText: process.env.TPL ?? "Project Closure" }).first().click(); await page.waitForTimeout(9000);
console.log(page.url()); console.log((await page.locator("main").innerText()).slice(0,900));
await page.screenshot({path:process.env.SHOT});
await browser.close(); process.exit(0);
