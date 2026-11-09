import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("wait2");
for (let i = 0; i < 80; i++) { await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000); const t = await page.locator("main").innerText(); const n = (t.match(/This section is being written/g)||[]).length; console.log(i, "pending sections:", n); if (!n) { console.log(t.slice(t.indexOf("This Month")-50, t.indexOf("This Month")+1500)); break; } await page.waitForTimeout(9000); }
await page.screenshot({path:process.env.SHOT, fullPage:true});
await browser.close(); process.exit(0);
