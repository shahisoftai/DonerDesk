import { attach, dump } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("exp2"); const d = page.locator("[role=dialog]").first();
if (process.argv[2]) await d.getByRole("button", { name: process.argv[2] }).click(); await page.waitForTimeout(2500);
console.log((await d.innerText()).replace(/\n+/g," | ").slice(0,2200));
console.log((await dump(page)).filter(l=>/button|checkbox|select|radio/.test(l)&&!/^a /.test(l)&&!/Approved|^button \| button \|  \|  \| [0-9]/.test(l)).slice(-14).join("\n"));
await browser.close(); process.exit(0);
