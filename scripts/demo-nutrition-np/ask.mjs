import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("ask");
await page.goto(BASE + "/settings", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
const cb = page.locator("section", { hasText: "Ask DonorDesk" }).locator("input[type=checkbox]").first(); if (!(await cb.isChecked())) { await cb.check(); await page.waitForTimeout(3000); } console.log("ask on", await cb.isChecked());
await page.goto(BASE + "/projects/14d6f13d-34ee-47ef-9d64-d16595e3e690/ask", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
const q = page.locator("main textarea, main input[type=text]").first(); await q.fill("What was the SAM cure rate in January 2027 and how does it compare with the target?");
await page.getByRole("button", { name: /^Ask/ }).last().click(); await page.waitForTimeout(40000);
console.log((await page.locator("main").innerText()).slice(-900));
await browser.close(); process.exit(0);
