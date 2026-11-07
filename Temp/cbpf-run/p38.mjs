import { attach } from "./lib.mjs";
const { page, browser, step, shot } = await attach("results-fix");
const nav = page.getByRole("navigation", { name: "Create a project" });
const rail = async () => (await nav.getByRole("button",{name:/Results/}).innerText()).replace(/\n/g," ");
const slide = page.locator("section[aria-roledescription='slide']");
const pickLike = async (sel, re) => { for (const o of await sel.locator("option").all()) { const t = (await o.innerText()).replace(/\s+/g," "); if (re.test(t)) { await sel.selectOption(await o.getAttribute("value")); await page.waitForTimeout(500); return; } } throw new Error("no option "+re); };
const f = slide.locator("fieldset", { hasText: "Add a result" });
await step("add temp output", async () => {
  await f.getByLabel("Kind", { exact: true }).selectOption("OUTPUT");
  await f.getByLabel("What will be achieved").fill("TMP temporary output");
  await pickLike(f.getByLabel("Belongs to"), /^OC|Crisis-affected/);
  await f.getByRole("button", { name: "Add a result" }).click(); await page.waitForTimeout(1000); });
for (const r of await slide.locator("li, article").filter({ hasText: "ACTIVITY" }).all()) {
  const s = r.locator("select").first();
  await pickLike(s, /TMP temporary/); await pickLike(s, /Emergency water, sanitation/);
}
await step("remove temp output", async () => { const r = slide.locator("li, article").filter({ has: page.locator('input[value^="TMP"]') }).first(); await r.getByRole("button",{name:"Remove"}).click(); await page.waitForTimeout(1000); });
const keep = page.getByRole("button", { name: /Keep the \d+ codes/ }); if (await keep.count()) { await keep.click(); await page.waitForTimeout(900); }
console.log("final:", await rail());
await shot("results-fixed");
await browser.close();
