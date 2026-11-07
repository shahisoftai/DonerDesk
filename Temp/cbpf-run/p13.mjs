import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("indicators");
const slide = page.locator("section[aria-roledescription='slide']");
const pickLike = async (sel, re) => { for (const o of await sel.locator("option").all()) { const t = (await o.innerText()).replace(/\s+/g," "); if (re.test(t)) { await sel.selectOption(await o.getAttribute("value")); await page.waitForTimeout(250); return; } } throw new Error("no option "+re); };
const card = slide.locator("article").first();
const t = async (c, label, v) => { const b = c.getByLabel(label,{exact:true}); await b.fill(v); await b.press("Tab"); await page.waitForTimeout(300); };
await step("fix female participation as percentage", async () => {
  await card.getByLabel("Kind of number").selectOption("PERCENTAGE"); await page.waitForTimeout(300);
  await t(card, "Unit", "%"); await t(card, "Starting value", "0"); await t(card, "Target", "53");
  await card.getByLabel("How often").selectOption("Quarterly"); await page.waitForTimeout(300);
  await t(card, "Break down by (separate with commas)", "");
});
const f = slide.locator("fieldset", { hasText: "Add an indicator" });
await step("add people reached", async () => {
  await f.getByLabel("What will be measured").fill("Number of people reached with emergency water services in vulnerable settlements and communities");
  await pickLike(f.getByLabel("Measures"), /^Output OP1/);
  await f.getByRole("button", { name: "Add an indicator" }).click(); await page.waitForTimeout(1000);
});
const c2 = slide.locator("article").nth(1);
await step("complete people reached", async () => {
  await c2.getByLabel("Kind of number").selectOption("NUMBER"); await page.waitForTimeout(300);
  await t(c2, "Unit", "people"); await t(c2, "Starting value", "0"); await t(c2, "Target", "13500");
  await c2.getByLabel("How often").selectOption("Monthly"); await page.waitForTimeout(300);
  await t(c2, "Break down by (separate with commas)", "Women, Girls, Men, Boys");
  await pickLike(c2.getByLabel("Responsible"), /M&E Officer/);
  await c2.getByLabel("Better when").selectOption("HIGHER"); await page.waitForTimeout(500);
});
const cards = await slide.locator("article").all();
for (const c of cards) console.log("-", (await c.locator("input").first().inputValue()).slice(0,60), "|", (await c.innerText()).split("\n").slice(0,3).join(" / "));
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await shot("indicators-done");
await browser.close();
