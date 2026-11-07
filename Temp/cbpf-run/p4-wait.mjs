import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("wait-read");
for (let i = 0; i < 30; i++) {
  const t = await page.locator("main, body").first().innerText();
  const reading = /Reading your documents/.test(t);
  console.log(i, reading ? "reading" : "done");
  if (!reading) break;
  await page.waitForTimeout(10000);
}
await shot("after-read");
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).slice(0, 2500));
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g, " | "));
await browser.close();
