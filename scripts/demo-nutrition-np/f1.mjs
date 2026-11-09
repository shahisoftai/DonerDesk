import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("f1");
await page.getByRole("button", { name: "Start fresh" }).click().catch(()=>{}); await page.waitForTimeout(800);
await page.getByRole("button", { name: "Pick a day" }).click(); await page.waitForTimeout(500);
await page.getByText("Add detail", { exact: false }).first().click(); await page.waitForTimeout(800);
console.log(await page.evaluate(() => [...document.querySelectorAll("main input,main select,main textarea")].map((e) => (e.name||e.id)+":"+e.type+":"+(e.getAttribute("aria-label")||"")).join("\n")));
await page.screenshot({path:process.env.SHOT, fullPage:true});
await browser.close(); process.exit(0);
