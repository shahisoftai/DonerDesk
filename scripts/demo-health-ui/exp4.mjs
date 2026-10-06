import { attach, dump } from "./lib.mjs";
const { page, browser } = await attach(); const d = page.locator('[role=dialog]').first();
await d.getByRole("button", { name: /Next: review/ }).click(); await page.waitForTimeout(2500);
console.log((await d.innerText()).slice(0, 2500)); console.log((await dump(page)).filter(l=>/button|radio|checkbox/.test(l) && /(Next|Back|Export|Close|Download|Internal|submission|Create|Generate|Confirm)/i.test(l) && !/Approved|^a /.test(l)).join("\n"));
await browser.close(); process.exit(0);
