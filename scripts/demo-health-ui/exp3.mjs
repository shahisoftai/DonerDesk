import { attach, dump } from "./lib.mjs";
const { page, browser } = await attach(); const d = page.locator('[role=dialog]').first();
await d.locator("select").first().selectOption({ label: "Word document" }); await page.waitForTimeout(500);
await d.getByRole("button", { name: /Next/ }).click(); await page.waitForTimeout(2500);
console.log((await d.innerText()).slice(0, 2500)); console.log((await dump(page)).filter(l=>/button|radio|checkbox/.test(l) && /(Next|Back|Export|Close|Download|Internal|submission|Create|Generate)/i.test(l)).join("\n"));
await browser.close(); process.exit(0);
