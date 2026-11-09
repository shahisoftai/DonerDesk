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
  if (!/Turkana|remedial|Assistive/.test(title)) continue;
  await page.goto(BASE + href, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
  const s = page.locator("section", { has: page.locator("#places-title") });
  await s.locator("#place-search").fill("Lodwar"); await page.waitForTimeout(1500); await s.locator("button").filter({ hasText: /^Lodwar ›/ }).first().click().catch(() => console.log("fail")); await page.waitForTimeout(1800);
  console.log("pinned", title.slice(0, 60));
}
await browser.close(); process.exit(0);
