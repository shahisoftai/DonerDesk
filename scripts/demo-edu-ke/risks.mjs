import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("risks");
const rows = await page.evaluate(() => { const sels = [...document.querySelectorAll("main select")]; const out = []; for (let i = 0; i + 1 < sels.length; i += 2) { const r = sels[i].parentElement.closest("div[class],li") ; let c = sels[i]; for (let k = 0; k < 6; k++) { c = c.parentElement; if (c.querySelectorAll("select").length === 2) continue; break; } out.push([sels[i].options[sels[i].selectedIndex].text, sels[i + 1].options[sels[i + 1].selectedIndex].text, (sels[i].parentElement.parentElement.parentElement.innerText || "").slice(0, 120).replace(/\n/g, " ")].join(" | ")); } return out; });
console.log(rows.join("\n")); console.log(await page.locator("main select").count());
await browser.close(); process.exit(0);
