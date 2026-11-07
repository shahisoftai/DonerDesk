import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("finance");
const slide = page.locator("section[aria-roledescription='slide']");
const dump = async () => { for (const r of await slide.locator("li, article").all()) { const ins = await r.locator("input").evaluateAll(i=>i.map(x=>x.value)); if (ins.length) console.log("  row", JSON.stringify(ins), JSON.stringify(await r.locator("select").evaluateAll(s=>s.map(x=>x.selectedOptions[0]?.textContent?.slice(0,30))))); } };
await dump();
await step("funding", async () => {
  const f = slide.locator("fieldset", { hasText: "Add funding" });
  await f.getByLabel("From").fill("Somalia Humanitarian Fund (CBPF)");
  await f.getByLabel("Amount").fill("500,000.30");
  await f.getByLabel("Currency (three letters)").fill("USD");
  await f.getByRole("button", { name: "Add funding" }).click(); await page.waitForTimeout(1000);
});
await step("place lines as whole-project costs", async () => {
  for (const s of await slide.locator("select").all()) { const opts = await s.locator("option").allInnerTexts(); if (opts.includes("A cost of the whole project") && !(await s.inputValue())) { await s.selectOption({ label: "A cost of the whole project" }); await page.waitForTimeout(600); } }
});
await step("confirm all", async () => { const b = page.getByRole("button",{name:/Confirm all \d+ that are waiting/}); if (await b.count()) { await b.click(); await page.waitForTimeout(900); } });
await dump();
console.log((await slide.innerText()).replace(/\n+/g," | ").match(/Does it add up[\s\S]{0,400}/)?.[0]);
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await shot("finance-after");
await browser.close();
