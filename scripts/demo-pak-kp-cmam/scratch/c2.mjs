import { attach } from "../lib.mjs";
const { page, browser } = await attach("c2");
const sv = page.getByLabel("Starting value", { exact: true }), ns = page.getByLabel("No starting value", { exact: true }), bt = page.getByLabel("Better when", { exact: true });
for (const i of [0, 11, 12, 54]) console.log(i, "start", JSON.stringify(await sv.nth(i).inputValue()), "dis", await sv.nth(i).isDisabled(), "none", await ns.nth(i).isChecked(), "better", await bt.nth(i).inputValue());
await browser.close();
