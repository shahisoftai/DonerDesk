import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("flg4"); page.setDefaultTimeout(12000);
const titles = await page.evaluate(() => { const o=[...document.querySelectorAll("ol li, nav li, aside li")].map(l=>l.innerText.split("\n").filter(Boolean)).filter(a=>/^\d+$/.test(a[0]) && a[1]); return o.map(a=>a[1]); });
console.log(titles.join(" | "));
for (const t of [...new Set(titles)]) {
  await page.getByText(t, { exact: true }).first().click().catch(()=>{}); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /^Statements/ }).first().click().catch(()=>{}); await page.waitForTimeout(1500);
  const b = page.getByRole("button", { name: "This matches a verified indicator" }); let n = 0;
  while (await b.count() && n < 20) { await b.first().click(); await page.waitForTimeout(2800); n++; }
  const left = (await page.locator("body").innerText()).match(/\d+ of \d+ statements need your decision/)?.[0];
  console.log(t, "clicked", n, "|", left);
}
console.log((await page.locator("body").innerText()).match(/Review \d+ flagged statements?|\d+ issues/g));
await browser.close(); process.exit(0);
