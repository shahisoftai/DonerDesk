import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("read");
await page.getByRole("button", { name: "Read my documents" }).click();
for (let i = 0; i < 60; i++) { await page.waitForTimeout(5000); const t = await page.locator("main").innerText(); if (!/being read|reading/i.test(t.split("Have project documents")[1]?.slice(0,900) ?? "")) break; }
await page.screenshot({ path: process.env.SHOT });
console.log((await page.locator("main").innerText()).split("Have project documents?")[1]?.slice(0, 1800));
await browser.close(); process.exit(0);
