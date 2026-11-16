import { attach, BASE } from "./lib.mjs";
const { page, step, browser } = await attach("login");
await step("login", async () => {
  await page.goto(BASE + "/login");
  await page.getByLabel(/email/i).first().fill(process.env.U);
  await page.getByLabel(/password/i).first().fill(process.env.P);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForURL((u) => !/login/.test(u.toString()), { timeout: 30000 });
});
console.log(page.url());
await step("wizard", async () => { await page.goto(BASE + "/projects/new/wizard"); await page.waitForSelector("h1"); });
console.log((await page.locator("body").innerText()).slice(0, 2500));
await browser.close();
