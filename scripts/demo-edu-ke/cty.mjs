import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("cty"); page.setDefaultTimeout(15000);
await page.goto("https://donordesk.online/settings/places", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000); await page.locator("main select").first().selectOption({ label: "Kenya" }); await page.waitForTimeout(4000);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Country")+0, t.indexOf("Country")+1500).replace(/\n+/g," | ").slice(0,1500));
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map(b=>b.innerText.trim()).filter(Boolean).slice(0,20).join(" | ")));
await browser.close(); process.exit(0);
