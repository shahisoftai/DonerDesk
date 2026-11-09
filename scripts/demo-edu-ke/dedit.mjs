import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dedit"); page.setDefaultTimeout(15000);
await page.goto(BASE + "/dashboards/7453e12b-f79b-439c-9f65-2f6ef791f207", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map(b=>b.innerText.trim()).filter(Boolean).slice(0,30).join(" | ")));
await page.getByRole("button", { name: /^Edit/ }).first().click().catch(()=>console.log("no edit")); await page.waitForTimeout(2000);
console.log(await page.evaluate(() => [...document.querySelectorAll("main button, main select")].map(b=>(b.getAttribute("aria-label")||b.innerText).trim().slice(0,30)).filter(Boolean).join(" | ")).then(s=>s.slice(0,900)));
await browser.close(); process.exit(0);
