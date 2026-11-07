import { attach } from "./lib.mjs";
const { page, browser, step, shot } = await attach("results-rebuild");
const nav = page.getByRole("navigation", { name: "Create a project" });
const rail = async () => (await nav.getByRole("button",{name:/Results/}).innerText()).replace(/\n/g," ");
const slide = page.locator("section[aria-roledescription='slide']");
const pickLike = async (sel, re) => { for (const o of await sel.locator("option").all()) { const t = (await o.innerText()).replace(/\s+/g," "); if (re.test(t)) { await sel.selectOption(await o.getAttribute("value")); await page.waitForTimeout(300); return; } } throw new Error("no option "+re); };
for (const t of ["Emergency water, sanitation", "Crisis-affected people"]) await step("remove " + t, async () => {
  const r = slide.locator("li, article").filter({ has: page.locator(`input[value^="${t}"]`) }).first();
  await r.getByRole("button", { name: "Remove" }).click(); await page.waitForTimeout(1000); });
console.log("after removing:", await rail());
const f = slide.locator("fieldset", { hasText: "Add a result" });
const add = async (kind, title, parent) => step("add " + kind, async () => {
  await f.getByLabel("Kind", { exact: true }).selectOption(kind);
  await f.getByLabel("What will be achieved").fill(title);
  await pickLike(f.getByLabel("Belongs to"), parent);
  await f.getByRole("button", { name: "Add a result" }).click(); await page.waitForTimeout(1000); });
await add("OUTCOME", "Crisis-affected people in Baidoa District have safe, equitable and dignified access to WASH services", /G1/);
console.log("after outcome:", await rail());
await add("OUTPUT", "Emergency water, sanitation and hygiene services delivered to IDP and host community households", /^OC|Crisis-affected/);
console.log("after output:", await rail());
for (const r of await slide.locator("li, article").filter({ hasText: "ACTIVITY" }).all()) { const s = r.locator("select").first(); const cur = await s.evaluate(x=>x.selectedOptions[0]?.textContent ?? ""); if (!/Emergency water, sanitation/.test(cur)) { await pickLike(s, /Emergency water, sanitation/); } }
console.log("after parenting:", await rail());
const keep = page.getByRole("button", { name: /Keep the \d+ codes/ }); if (await keep.count()) { await keep.click(); await page.waitForTimeout(900); }
console.log("final:", await rail());
await browser.close();
