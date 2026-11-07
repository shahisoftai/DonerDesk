import { attach } from "./lib.mjs";
const { page, browser } = await attach("cleanup");
const nav = page.getByRole("navigation", { name: "Create a project" });
await nav.getByRole("button",{name:/Results framework/}).click(); await page.waitForTimeout(900);
const slide = page.locator("section[aria-roledescription='slide']");
const r = slide.locator("li").filter({ has: page.locator('input[value^="TMP"]') }).first();
console.log("tmp rows:", await r.count());
if (await r.count()) { await r.getByRole("button",{name:/Remove/}).click(); await page.waitForTimeout(1000); }
const k = page.getByRole("button",{name:/Keep the \d+ codes/}); if (await k.count()) { await k.click(); await page.waitForTimeout(900); }
console.log((await nav.innerText()).replace(/\n/g," | ").slice(0,330));
console.log((await page.getByRole("complementary",{name:/Still to answer/}).innerText()).replace(/\n+/g," | ").slice(0,500));
await browser.close();
