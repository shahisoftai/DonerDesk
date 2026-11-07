import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach("e310");
const id = "f93c1288-5e5d-4095-a1ec-015319d33c9a";
for (const u of [`/projects/new/wizard?id=${id}`, `/projects`, `/projects/new`]) {
  console.log("--", u); await page.goto(BASE + u); await page.waitForTimeout(3500);
}
await browser.close();
