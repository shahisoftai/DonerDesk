import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("parents");
const rows = await page.evaluate(() => [...document.querySelectorAll("main select")].map((s) => { const row = s.closest("li,div[class*=row],div"); const code = row?.parentElement?.innerText.split("\n").slice(0,3).join(" | "); return code + "  => " + s.options[s.selectedIndex]?.text.slice(0, 20); }));
console.log(rows.join("\n"));
await browser.close(); process.exit(0);
