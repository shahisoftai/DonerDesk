import { attach, BASE } from "./lib.mjs";
const { page, step, browser } = await attach("login");
await step("sign in", async () => {
  await page.getByLabel("Email").fill(process.env.DD_EMAIL);
  await page.getByLabel("Password").fill(process.env.DD_PASS);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 20000 });
});
console.log(page.url());
console.log((await page.locator("body").innerText()).slice(0, 900));
await browser.close();
