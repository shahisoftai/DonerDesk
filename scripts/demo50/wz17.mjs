import { open, tabs, todo, shot } from "./wz.mjs";
const { page, browser } = await open("wz17");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
const panel = page.locator("fieldset, div", { has: page.getByRole("button", { name: "Add an indicator" }) }).last();
await panel.scrollIntoViewIfNeeded();
console.log((await panel.innerText()).replace(/\n+/g," / ").slice(0,600));
console.log(await panel.locator("input,select").evaluateAll(s=>s.map(x=>[x.tagName,x.type,x.getAttribute("aria-label")||x.placeholder||(x.closest("label")?.innerText||"").slice(0,25)])));
await page.screenshot({ path: "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad/wz17.png" });
await browser.close(); process.exit(0);
