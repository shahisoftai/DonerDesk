import { open, tabs, todo, shot } from "./wz.mjs";
const { page, browser } = await open("wz13");
await page.getByRole("button", { name: /^4\. / }).click(); await page.waitForTimeout(2500);
const tg = page.getByLabel(/^Target/); for (let i = 0; i < await tg.count(); i++) { if (!(await tg.nth(i).inputValue())) await tg.nth(i).fill("100"); }
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Add an indicator" }).click(); await page.waitForTimeout(1500);
const last = async (label) => (label==="Target" ? page.getByLabel(/^Target/) : page.getByLabel(label, { exact: true })).last();
await (await last("What will be measured")).fill("Water quality tests passed at output level (test)");
const meas = await last("Measures"); await meas.selectOption({ label: (await meas.locator("option").allInnerTexts()).find(o=>/OP1\.1\.1-2/.test(o)) });
const kind = await last("Kind of number"); await kind.selectOption({ index: 1 });
await (await last("Unit")).fill("tests"); await (await last("Starting value")).fill("0"); await (await last("Target")).fill("50");
const freq = await last("How often"); await freq.selectOption({ index: 2 });
await (await last("Responsible")).selectOption({ index: 1 }); await (await last("Better when")).selectOption({ index: 1 });
await page.waitForTimeout(2500);
console.log(await tabs(page)); console.log(await todo(page));
await browser.close(); process.exit(0);
