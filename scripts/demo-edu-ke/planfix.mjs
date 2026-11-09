import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("planfix"); page.setDefaultTimeout(15000);
const T="Turkana County",G="Garissa County",M="Marsabit County",W="Wajir County",D="Mandera County";
const RULES = [["Turkana and Marsabit","enrolment","A1.1.1",[T,M]],["Garissa, Wajir and Mandera","enrolment","A1.1.1",[G,W,D]],["accelerated education centres - Turkana","","A1.1.2",[T,G]],["accelerated education centres - Marsabit","","A1.1.2",[M,W,D]],
["classrooms and school WASH facilities - Turkana","","A1.2.1",[T,M]],["classrooms and school WASH facilities - Garissa","","A1.2.1",[G,W,D]],["scholastic kits","","A1.2.2",[T,G,M,W,D]],["Train teachers","","A2.1.1",[G,D,M]],["Coaching","","A2.1.2",[T,G,M,W,D]],
["remedial","","A2.2.1",[T,G]],["radio","","A2.2.2",[W,D]],["school management committees","","A3.1.1",[M,W]],["Community dialogues","","A3.1.2",[D,W]],["bursaries","","A3.2.1",[G]],["Assistive","","A3.2.2",[T]]];
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/activities", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
await page.getByRole("button", { name: "List", exact: true }).first().click().catch(()=>{}); await page.waitForTimeout(1500);
await page.getByLabel("Completed", { exact: true }).check().catch(()=>{}); await page.waitForTimeout(2500);
const links = await page.evaluate(() => [...document.querySelectorAll("main a[href*='/activities/plan/']")].map(a => [a.innerText.trim(), a.getAttribute("href")]).filter(x => /plan\/[0-9a-f-]{36}/.test(x[1])));
console.log("items", links.length);
for (const [title, href] of links) {
  const r = RULES.find(([k, k2]) => title.includes(k) && (!k2 || title.includes(k2))); if (!r) { console.log("NO RULE", title); continue; }
  await page.goto(BASE + href, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
  const sel = page.locator("#lf-link"); const opts = await sel.locator("option").allTextContents(); const o = opts.find((x) => x.startsWith(r[2] + " "));
  if (o) { const cur = await sel.evaluate((e) => e.selectedOptions[0].text); if (!cur.startsWith(r[2] + " ")) { await sel.selectOption({ label: o }); await page.waitForTimeout(2500); const sv = page.locator("button", { hasText: /^Save$/ }).first(); if (await sv.isEnabled().catch(()=>false)) { await sv.click(); await page.waitForTimeout(2500); } } }
  const s = page.locator("section", { has: page.locator("#places-title") });
  for (const p of r[3]) { await s.locator("#place-search").fill(p); await page.waitForTimeout(1500); await s.locator("button").filter({ hasText: new RegExp("^" + p + " ›") }).first().click().catch(() => console.log("place fail", p)); await page.waitForTimeout(1800); }
  console.log("done", title.slice(0, 50), r[2], r[3].length);
}
await browser.close(); process.exit(0);
