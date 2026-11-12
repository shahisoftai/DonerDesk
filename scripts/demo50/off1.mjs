import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("off1");
await page.goto(BASE + "/field", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
await page.locator("select").filter({ has: page.locator("option", { hasText: "Choose a project" }) }).first().selectOption({ index: 1 }); await page.waitForTimeout(800);
await page.getByRole("button", { name: /Download or refresh/ }).click(); await page.waitForTimeout(6000);
const t = (await page.locator("body").innerText()).replace(/\n+/g," / "); console.log(t.slice(0,1500));
await browser.close(); process.exit(0);
