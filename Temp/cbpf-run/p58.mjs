import { attach } from "./lib.mjs";
const { page, browser, step } = await attach("manual-fix");
const nav = page.getByRole("navigation", { name: "Create a project" });
const slide = page.locator("section[aria-roledescription='slide']");
const go = async (l) => { await nav.getByRole("button",{name:new RegExp(l)}).click(); await page.waitForTimeout(900); };
await go("Results framework");
await step("remove SO outcomes", async () => { for (const n of ["Prevent loss of life", "Sustain people"]) { const r = slide.locator("li").filter({ has: page.locator(`input[value^="${n}"]`) }).first(); if (await r.count()) { await r.getByRole("button",{name:/Remove/}).click(); await page.waitForTimeout(1000); } } });
await step("parent unlinked activities", async () => { for (const r of await slide.locator("li").filter({ hasText: "ACTIVITY" }).all()) { const s = r.locator("select").first(); if (!(await s.inputValue())) { for (const o of await s.locator("option").all()) { if (/Emergency water, sanitation/.test(await o.innerText())) { await s.selectOption(await o.getAttribute("value")); await page.waitForTimeout(900); break; } } } } });
const k = page.getByRole("button",{name:/Keep the \d+ codes/}); if (await k.count()) { await k.click(); await page.waitForTimeout(800); }
await go("Work plan");
await step("remove placeholder plan item", async () => { const r = slide.locator("article").filter({ has: page.locator('input[value="Activity 1.1.1"]') }).first(); if (await r.count()) { await r.getByRole("button",{name:/Remove/}).click(); await page.waitForTimeout(900); } });
await go("Budget and finance");
await step("fix budget/funding rows", async () => {
  const rows = slide.locator("li, article");
  const g = rows.filter({ has: page.locator('input[value^="G.1"]') }).first();
  const gi = g.locator("input"); await gi.nth(1).fill("467290.00"); await gi.nth(1).press("Tab"); await page.waitForTimeout(500); await gi.nth(2).fill("USD"); await gi.nth(2).press("Tab"); await page.waitForTimeout(800);
  const d = rows.filter({ has: page.locator('input[value="CBPF"]') }).first(); if (await d.count()) { await d.getByRole("button",{name:/Remove/}).click(); await page.waitForTimeout(900); }
  const c = page.getByRole("button",{name:/Confirm all \d+ that are waiting/}); if (await c.count()) { await c.click(); await page.waitForTimeout(900); }
});
console.log((await nav.innerText()).replace(/\n/g," | ").slice(0,330));
console.log((await page.getByRole("complementary",{name:/Still to answer/}).innerText()).replace(/\n+/g," | ").slice(0,700));
await browser.close();
