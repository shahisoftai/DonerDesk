import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("f2");
await page.goto(`${BASE}/projects/14d6f13d-34ee-47ef-9d64-d16595e3e690/activities/new`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
await page.getByRole("button", { name: "Start fresh" }).click().catch(()=>{});
await page.locator("input[type=file]").first().setInputFiles([process.env.F]); await page.waitForTimeout(2000);
await page.screenshot({path:process.env.SHOT, fullPage:false});
console.log(await page.evaluate(() => [...document.querySelectorAll("main details summary, main button")].map(e=>e.innerText.trim().slice(0,40)).filter(Boolean).join(" | ")));
await browser.close(); process.exit(0);
