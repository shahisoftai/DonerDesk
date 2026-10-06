import { attach, dump } from "./lib.mjs";
const { page, browser } = await attach(); const d = page.locator('[role=dialog]').first();
await d.getByRole("button", { name: /Create export/ }).click(); await page.waitForTimeout(12000);
console.log((await d.innerText().catch(()=>"(dialog gone)")).slice(0, 1500)); console.log((await dump(page)).filter(l=>/Download|export/i.test(l)).slice(0,10).join("\n"));
await browser.close(); process.exit(0);
