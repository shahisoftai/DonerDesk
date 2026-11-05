import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("due");
const d = page.getByLabel("Due (days after the period ends)");
const n = await d.count(); const vals = ["", "15", "30"];
const titles = await page.evaluate(() => [...document.querySelectorAll("main input")].filter((i) => i.getAttribute("type") !== "checkbox").length);
for (let i = 0; i < n; i++) { const v = await d.nth(i).inputValue(); if (!v) { await d.nth(i).fill(i === 1 ? "15" : "30"); await d.nth(i).blur(); } }
await page.waitForTimeout(1500);
console.log(n, "due fields");
await browser.close(); process.exit(0);
