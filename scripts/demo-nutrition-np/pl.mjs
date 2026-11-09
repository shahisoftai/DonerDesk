import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pl");
const q = page.getByLabel("Search areas");
for (const n of ["Jumla","Kalikot","Mugu","Humla","Bajura"]) {
  await q.fill(n); await page.waitForTimeout(1200);
  const boxes = page.locator("main input[type=checkbox]");
  const labels = await page.locator("main label").filter({ hasText: n }).allInnerTexts();
  console.log(n, JSON.stringify(labels.slice(0,5)));
  const first = page.locator("main label").filter({ hasText: new RegExp("^\\s*"+n) }).first();
  if (await first.count()) { const cb = first.locator("input[type=checkbox]"); if (!(await cb.isChecked())) await cb.check(); await page.waitForTimeout(800); }
}
await q.fill(""); await page.waitForTimeout(1000);
const t = await page.locator("main").innerText(); console.log(t.match(/(Nothing ticked yet|Ticked[\s\S]{0,300})/)?.[0]);
await page.screenshot({path:process.env.SHOT});
await browser.close(); process.exit(0);
