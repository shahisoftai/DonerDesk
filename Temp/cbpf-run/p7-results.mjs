import { attach } from "./lib.mjs";
const { page, step, shot, browser, text } = await attach("results");
const slide = page.locator("section[aria-roledescription='slide']");
const pickLike = async (sel, re) => { for (const o of await sel.locator("option").all()) { const t = (await o.innerText()).replace(/\s+/g, " "); if (re.test(t)) { await sel.selectOption(await o.getAttribute("value")); await page.waitForTimeout(250); return; } } throw new Error("no option " + re); };
await step("confirm all waiting", async () => { await page.getByRole("button", { name: /Confirm all \d+ that are waiting/ }).click(); await page.waitForTimeout(800); });
const f = page.locator("fieldset", { hasText: "Add a result" });
const add = async (kind, title, parent) => { await step(`add ${kind}`, async () => {
  await f.getByLabel("Kind", { exact: true }).selectOption(kind);
  await f.getByLabel("What will be achieved").fill(title);
  if (parent) await pickLike(f.getByLabel("Belongs to"), parent);
  await f.getByRole("button", { name: "Add a result" }).click(); await page.waitForTimeout(800); }); };
await add("OUTCOME", "Crisis-affected people in Baidoa District have safe, equitable and dignified access to WASH services", /G1/);
await add("OUTPUT", "Emergency water, sanitation and hygiene services delivered to IDP and host community households", /OUTCOME|Crisis-affected/);
await step("parent activities under output", async () => {
  const selects = await slide.locator("select").all();
  console.log("selects", selects.length);
  for (const s of selects) {
    const opts = (await s.locator("option").allInnerTexts()).join("|");
    if (/Emergency water, sanitation/.test(opts) && !(await s.inputValue())) { await pickLike(s, /Emergency water, sanitation/); }
  }
});
await step("keep codes", async () => { const b = page.getByRole("button", { name: /Keep the \d+ codes made up/ }); if (await b.count()) await b.click(); await page.waitForTimeout(800); });
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g, " | "));
console.log((await slide.innerText()).slice(0, 1800));
await browser.close();
