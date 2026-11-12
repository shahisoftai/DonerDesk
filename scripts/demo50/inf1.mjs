import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("inf1");
await page.goto(BASE + "/visuals/assets?project=cd291c72-ebc9-4f16-8633-b7c9007507ed", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(5000);
await page.getByRole("button", { name: "New infographic" }).click(); await page.waitForTimeout(3500);
console.log("GALLERY:", (await page.locator("main").innerText()).replace(/\n+/g," / ").match(/New infographic[^]{0,1100}/)?.[0]);
await page.screenshot({ path: S + "/inf1.png" });
await browser.close(); process.exit(0);
