import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("radios");
const r = await page.evaluate(() => [...document.querySelectorAll("input[type=radio]")].map((i) => `${i.checked ? "*" : " "} ${(i.closest("label")?.textContent || "").slice(0, 40)}`));
console.log(r.filter((x) => /\*|blank/i.test(x)).join("\n"));
await browser.close(); process.exit(0);
