import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("workplan");
const slide = page.locator("section[aria-roledescription='slide']");
console.log("suggest section:", await slide.getByText(/Links we suggest/).count());
const cards = await slide.locator("article").all();
const feedsMap = { "Emergency water": ["IND1-2"], "Rehabilitation": ["IND1-2"], "Installation": ["IND1-2"], "Distribution": ["IND1-2","IND1 ·"], "Community-led": ["IND1 ·"] };
for (const c of cards) {
  const title = await c.locator("input").first().inputValue();
  const key = Object.keys(feedsMap).find(k => title.startsWith(k)); if (!key) continue;
  const boxes = await c.getByRole("checkbox").all();
  const labels = []; for (const b of boxes) labels.push([await b.evaluate(e=>e.closest("label")?.textContent?.trim()), await b.isChecked()]);
  console.log(title.slice(0,25), JSON.stringify(labels));
  for (const want of feedsMap[key]) {
    await step(`feeds ${want} for ${key}`, async () => {
      const lb = c.locator("label").filter({ hasText: want.replace(" ·","") === "IND1" ? /^IND1 ·/ : want }).first();
      const cb = lb.getByRole("checkbox"); if (!(await cb.isChecked())) { await cb.click(); await page.waitForTimeout(700); }
    });
  }
}
console.log((await slide.innerText()).match(/Activities with planned work[\s\S]{0,160}/)?.[0].replace(/\n+/g," | "));
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
await browser.close();
