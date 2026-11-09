import { attach, BASE } from "../demo-ui/lib.mjs"; import fs from "node:fs";
const { page, browser } = await attach("reclink"); page.setDefaultTimeout(15000);
const MAP = [["Community enrolment drive","Community enrolment drives - Turkana"],["Accelerated education centre","accelerated education centres - Marsabit"],["Classroom and school WASH","classrooms and school WASH facilities - Garissa"],["Scholastic kit","Distribute scholastic kits"],["Teacher training","Train teachers"],["Teacher coaching","Coaching and classroom"],["Remedial","Run remedial"],["Radio and digital","Deliver radio"],["School management committee","Train school management committees"],["Community dialogue","Community dialogues"],["Girls' bursaries","Provide bursaries"],["Support for learners","Assistive support"]];
const LOG = process.env.S + "/reclink.done"; const done = new Set(fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n") : []);
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/activities?view=completed", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
const links = await page.evaluate(() => [...new Map([...document.querySelectorAll("main a[href*='/activities/']")].map(a => [a.getAttribute("href"), a.innerText.trim().split("\n")[0]])).entries()].filter(([h]) => /activities\/[0-9a-f-]{36}/.test(h)));
console.log("records", links.length);
for (const [href, title] of links) {
  if (done.has(href)) continue; const m = MAP.find(([k]) => title.includes(k)); if (!m) { console.log("NO MAP", title); continue; }
  await page.goto(BASE + href, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500);
  const ro = page.getByRole("button", { name: /^Reopen for correction/ });
  if (await ro.count()) { await ro.click(); await page.waitForTimeout(1000); await page.locator("#reopenNote, [name=reopenNote], textarea").last().fill("Link this record to its planned activity."); await page.getByRole("button", { name: "Send back for correction" }).click(); await page.waitForTimeout(3500); }
  const sel = page.locator("select").filter({ hasText: "Choose a planned activity" }).first(); if (!(await sel.count())) { console.log("no select", title); continue; }
  const o = (await sel.locator("option").allTextContents()).find((x) => x.includes(m[1])); if (!o) { console.log("no option", title); continue; }
  await sel.selectOption({ label: o }); await page.waitForTimeout(800); await page.getByRole("button", { name: "Save link" }).click(); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Resubmit for review" }).click(); await page.waitForTimeout(3000);
  fs.appendFileSync(LOG, href + "\n"); console.log("ok", title.slice(0, 50));
}
console.log("ALL_DONE"); await browser.close(); process.exit(0);
