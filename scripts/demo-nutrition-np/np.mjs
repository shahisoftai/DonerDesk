import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("np");
const cb = page.locator("label", { hasText: "There are no outside partners" }).locator("input[type=checkbox]");
console.log(await cb.count(), await cb.isChecked().catch(()=>"?"));
if (!(await cb.isChecked())) { await cb.click(); await page.waitForTimeout(2500); }
console.log(await cb.isChecked(), (await page.locator("main").innerText()).match(/Still to answer \(\d+\)/)?.[0]);
await browser.close(); process.exit(0);
