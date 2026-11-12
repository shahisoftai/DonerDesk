import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("ed4");
await page.goto(BASE + "/visuals/fee3d075-90d6-4c46-b028-09e0d812852a", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(8000);
await page.getByRole("button", { name: "Edit", exact: true }).click(); await page.waitForTimeout(3500);
const lay = await page.locator("main").innerText(); console.log("has Layers list:", /Layers/.test(lay));
console.log("layer rows:", (await page.locator("aside li, aside [role=listitem]").allInnerTexts().catch(()=>[])).slice(0,12));
await page.screenshot({ path: S + "/ed4.png" });
await browser.close(); process.exit(0);
