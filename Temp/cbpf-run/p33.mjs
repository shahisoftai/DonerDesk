import { attach } from "./lib.mjs";
const { page, browser, shot, step } = await attach("launch");
const slide = page.locator("section[aria-roledescription='slide']");
await step("add assumption", async () => {
  const f = slide.locator("fieldset", { hasText: "Add a risk or assumption" });
  await f.getByLabel("What it is", { exact: true }).selectOption("ASSUMPTION");
  await f.getByLabel("What it is about").fill("Community leaders, ABC members and local authorities keep supporting safe access to target villages");
  await f.getByLabel("How serious").selectOption("MEDIUM");
  await f.getByRole("button", { name: "Add a risk or assumption" }).click(); await page.waitForTimeout(900);
});
await step("confirm if waiting", async () => { const b = page.getByRole("button",{name:/^Confirm$/}); while (await b.count()) { await b.first().click(); await page.waitForTimeout(700); } });
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,330));
console.log((await slide.innerText()).replace(/\n+/g," | ").match(/Sign off \|[\s\S]{0,200}/)?.[0]);
await browser.close();
