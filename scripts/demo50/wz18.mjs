import { open, tabs, todo } from "./wz.mjs";
const { page, browser } = await open("wz18");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
await page.getByLabel("What will be measured", { exact: true }).last().fill("Water quality tests passed (test)");
const m = page.getByLabel("Measures", { exact: true }).last();
await m.selectOption({ label: (await m.locator("option").allInnerTexts()).find(o=>/OP1\.1\.1-2/.test(o)) });
await page.getByRole("button", { name: "Add an indicator" }).click(); await page.waitForTimeout(3500);
const L = (l) => (l==="Target" ? page.getByLabel(/^Target/) : page.getByLabel(l, { exact: true }));
for (const [l, v] of [["Unit","tests"],["Starting value","0"],["Target","50"]]) { const e = L(l).last(); await e.click(); await e.fill(v); await e.press("Tab"); }
const k = L("Kind of number").last(); await k.selectOption({ index: 1 });
await L("How often").last().selectOption({ label: "Monthly" }); await L("Responsible").last().selectOption({ index: 1 }); await L("Better when").last().selectOption({ index: 1 });
await page.waitForTimeout(2500);
console.log(await tabs(page)); console.log((await todo(page))?.slice(0,500));
await browser.close(); process.exit(0);
