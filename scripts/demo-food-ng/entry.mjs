import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("entry");
const form = new Set(["OP1-1d", "OP1-2a", "OP1-2c"]);
const sel = page.locator("main select");
const n = await sel.count(); console.log("selects", n);
const codes = ["GI-1","OC1a","OC1b","OP1-1a","OP1-1b","OP1-1c","OP1-1d","OP1-2a","OP1-2b","OP1-2c","OC2a","OP2-1a","OP2-1b","OP2-2a","OP2-2b","OP3-1a","OP3-1b","OP3-2a"];
for (const [i, c] of codes.entries()) { await sel.nth(i).selectOption({ label: form.has(c) ? "A form in the field" : "Typed in" }); await page.waitForTimeout(700); }
await page.screenshot({ path: process.env.SHOT });
console.log((await page.locator("main").innerText()).split("Worked out from other indicators").slice(-1)[0].slice(0, 2500));
await browser.close(); process.exit(0);
