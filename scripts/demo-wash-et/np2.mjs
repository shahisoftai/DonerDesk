import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("np2");
await page.getByRole("link", { name: "Create reporting period" }).first().click().catch(async()=>page.getByRole("button", { name: "Create reporting period" }).first().click());
await page.waitForTimeout(3000); console.log(page.url());
console.log((await page.locator("main").innerText()).slice(0,1500));
console.log(await page.evaluate(() => [...document.querySelectorAll("main input,main select,main textarea")].map((e) => e.name+":"+e.type+":"+e.value).join(" | ")));
await page.screenshot({path:process.env.SHOT});
await browser.close(); process.exit(0);
