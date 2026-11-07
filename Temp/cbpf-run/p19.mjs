import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("workplan");
const slide = page.locator("section[aria-roledescription='slide']");
const pickLike = async (sel, re) => { for (const o of await sel.locator("option").all()) { const t = (await o.innerText()).replace(/\s+/g," "); if (re.test(t)) { await sel.selectOption(await o.getAttribute("value")); await page.waitForTimeout(250); return; } } throw new Error("no option "+re); };
await step("remove placeholder 'Activity 1.1.1'", async () => { await slide.locator("article").first().getByRole("button",{name:"Remove"}).click(); await page.waitForTimeout(800); });
const items = [
 ["Emergency water trucking to IDP sites and rural villages", /A1\.1/, "2025-09-01", "2026-02-28", /IND1-2/],
 ["Rehabilitation of strategic boreholes, shallow wells and distribution systems", /A1\.2/, "2025-09-15", "2025-12-15", /IND1-2/],
 ["Installation of gender-segregated emergency latrines in IDP settlements", /A1\.3/, "2025-10-01", "2026-01-15", /IND1-2/],
 ["Distribution of hygiene kits with hygiene promotion sessions", /A1\.4/, "2025-10-15", "2026-02-15", /IND1 ·|IND1-2/],
 ["Community-led hygiene promotion campaigns (cholera prevention)", /A1\.5/, "2025-09-15", "2026-02-28", /IND1 ·/],
];
const f = slide.locator("fieldset", { hasText: "Add an activity" });
let i = 0;
for (const [title, part, s, e, feeds] of items) {
  await step("add " + title.slice(0,30), async () => {
    await f.getByLabel("Activity", { exact: true }).fill(title);
    await pickLike(f.getByLabel("Part of"), part);
    await f.getByRole("button", { name: "Add an activity" }).click(); await page.waitForTimeout(1000);
  });
  const acc = page.getByRole("button", { name: /Accept all \d+/ });
  if (await acc.count()) { await acc.first().click(); await page.waitForTimeout(700); }
  await step("details " + title.slice(0,25), async () => {
    const card = slide.locator("article").filter({ has: page.locator(`input[value="${title.replace(/"/g,'\\"')}"]`) }).first();
    for (const [lab, v] of [["Starts", s], ["Ends", e]]) { const b = card.getByLabel(lab, {exact:true}); await b.fill(v); await b.press("Tab"); await page.waitForTimeout(300); }
    await pickLike(card.getByLabel("Led by"), /Abdullahi/);
    await card.getByRole("checkbox", { name: "Baidoa" }).check();
    await page.waitForTimeout(300);
  });
  i++;
}
console.log((await slide.innerText()).match(/Activities with planned work[\s\S]{0,200}/)?.[0].replace(/\n+/g," | "));
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await browser.close();
