import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("chrole2");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/team", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.locator("tr", { hasText: "ZZ Test Field" }).getByRole("button", { name: "Change role" }).click(); await page.waitForTimeout(1200);
const m = await page.evaluate(() => { const els=[...document.querySelectorAll("body *")].filter(e=>/Confirm change|New role|Will gain/.test(e.innerText||"") && e.innerText.length<1500); const el=els[els.length-1]; return el ? el.innerText.replace(/\n+/g," / ") : "none"; });
console.log("MODAL:", m);
await browser.close(); process.exit(0);
