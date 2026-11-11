import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("seed");
await page.goto(BASE + "/settings/places", { waitUntil: "domcontentloaded" });
const card = page.getByRole("region").filter({ hasText: "Add a country's places" }).first();
const sel = page.locator("select").filter({ has: page.locator("option", { hasText: "Choose a country" }) }).first();
await sel.waitFor({ timeout: 20000 });
const opts = await sel.locator("option").allTextContents();
await sel.selectOption({ label: opts.find((o) => /^Nepal/.test(o)) });
await page.waitForTimeout(800);
const lv = await page.evaluate(() => [...document.querySelectorAll("select,label")].map((e) => (e.textContent||"").trim().slice(0,60)).filter((t) => /level|province|district/i.test(t)));
console.log("level controls:", lv.join(" | "));
for (const l of ["Provinces or states", "Districts"]) { const c = page.getByLabel(l, { exact: true }); if (await c.count() && !(await c.isChecked())) await c.check(); }
await page.getByRole("button", { name: "See what would be added" }).click();
await page.waitForTimeout(6000);
const txt = await card.innerText(); console.log(txt.slice(txt.indexOf("See what would be added")).slice(0, 1800));
await browser.close(); process.exit(0);
