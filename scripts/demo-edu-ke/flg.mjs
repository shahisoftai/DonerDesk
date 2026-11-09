import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("flg"); page.setDefaultTimeout(15000);
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/reports/a46fa895-78db-48ec-a95f-c3c3ade94418", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000);
await page.getByRole("button", { name: /^Review \d+ flagged statements/ }).click().catch(()=>page.getByText(/Review \d+ flagged/).first().click()); await page.waitForTimeout(3500);
const t = await page.locator("body").innerText(); const i = t.indexOf("Statement"); console.log(t.slice(Math.max(0,i-200), i+2200));
console.log(await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button, [role=dialog] select, [role=dialog] textarea")].map(b=>(b.getAttribute("aria-label")||b.innerText||b.tagName).trim().slice(0,40)).slice(0,30)));
await browser.close(); process.exit(0);
