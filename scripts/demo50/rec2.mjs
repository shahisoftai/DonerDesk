import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("rec2");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: /^\+?\s*Record/ }).first().click(); await page.waitForTimeout(1200);
await page.getByText("‹ Back").first().click().catch(()=>{}); await page.waitForTimeout(1000);
const txt = async () => (await page.locator("[role=dialog], aside").last().innerText()).replace(/\n+/g," / ").slice(0,1200);
console.log("KINDS:", await txt());
await page.screenshot({ path: S + "/rec2.png" });
// open each kind and print form
const kinds = await page.locator("[role=dialog] button, aside button").allInnerTexts();
console.log("BUTTONS:", kinds.map(k=>k.replace(/\n+/g," - ")).join(" || "));
await browser.close(); process.exit(0);
