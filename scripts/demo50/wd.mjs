import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("wd");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/activities/6a1bd830-a4cf-4c6d-aac4-ac23898fc726", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
page.on("dialog", d => d.accept());
await page.getByRole("button", { name: "Withdraw this record" }).click(); await page.waitForTimeout(1200); await page.getByRole("button", { name: "Withdraw", exact: true }).click(); await page.waitForTimeout(3500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").replace(/^.*Templates \/ Team \/ Settings/,"").slice(0,260));
await browser.close(); process.exit(0);
