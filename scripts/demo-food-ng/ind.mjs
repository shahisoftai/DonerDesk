import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("ind");
const rows = await page.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => b.innerText === "Remove").map((b, i) => { let r = b; for (let k = 0; k < 6 && r.parentElement; k++) { r = r.parentElement; if (r.querySelectorAll("button").length >= 2 && r.querySelectorAll("input").length >= 3) break; } const inputs = [...r.querySelectorAll("input")].map((x) => x.value).slice(0, 8).join(" | "); return i + ": " + r.innerText.split("\n")[0] + " :: " + inputs; }));
console.log(rows.join("\n"));
await browser.close(); process.exit(0);
