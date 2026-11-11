import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rowdump");
const inputs = await page.evaluate(() => [...document.querySelectorAll("input[type=search],input[placeholder]")].map((i) => `${i.getAttribute("aria-label")}|${i.getAttribute("placeholder")}`));
console.log(inputs);
const rows = await page.getByRole("row").filter({ hasText: "Bajura" }).allInnerTexts();
console.log(rows.slice(0, 5));
await browser.close(); process.exit(0);
