import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("evper"); page.setDefaultTimeout(15000);
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/evidence?page=2", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
const M = {"03":"Mar","04":"Apr","05":"May","06":"Jun","07":"Jul","08":"Aug"};
const rows = page.locator("main table tbody tr"); const n = await rows.count(); console.log("rows", n);
for (let i = 0; i < n; i++) {
  const r = rows.nth(i); const name = (await r.locator("a").first().innerText()).trim(); const mm = M[name.slice(5,7)]; if (!mm) continue;
  const sel = r.locator("select[aria-label='Reporting period']"); const opts = await sel.locator("option").allTextContents(); const o = opts.find((x) => x.includes(mm + " 2026"));
  if (o && !(await sel.evaluate((e) => e.selectedOptions[0].text)).includes(mm)) { await sel.selectOption({ label: o }); await page.waitForTimeout(1800); }
}
console.log((await page.locator("main").innerText()).match(/\d+ file\(s\)/)?.[0]);
await browser.close(); process.exit(0);
