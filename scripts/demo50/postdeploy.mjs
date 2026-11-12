import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("postdeploy");
// Record fix
await page.goto(BASE + "/projects/14d6f13d-34ee-47ef-9d64-d16595e3e690", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
await page.getByRole("button", { name: /^\+?\s*Record/ }).first().click(); await page.waitForTimeout(1200);
const dlg = page.locator("[role=dialog], aside").last();
if (/What are you recording/.test(await dlg.innerText())) await dlg.getByRole("button", { name: /^A number/ }).click();
await page.waitForTimeout(1200);
const sel = dlg.locator("select").nth(1); await sel.selectOption({ label: (await sel.locator("option").allInnerTexts()).find((o)=>/^OP1-1a/.test(o)) });
await dlg.getByLabel(/How many/).fill("1"); await dlg.getByRole("button", { name: "Save" }).click(); await page.waitForTimeout(3500);
console.log("AFTER SAVE:", (await dlg.innerText().catch(()=>"(closed)")).replace(/\n+/g," / ").slice(-420));
await browser.close(); process.exit(0);
