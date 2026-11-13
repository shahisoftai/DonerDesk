import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-peek");
await page.goto(BASE + process.env.PATHX, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: process.env.OUT, fullPage: true });
const fields = await page.$$eval("input, select, textarea, button", (els) => els.filter((e) => e.offsetParent).map((e) => `${e.tagName.toLowerCase()}${e.type ? ":" + e.type : ""} id=${e.id} name=${e.getAttribute("name") ?? ""} label=${(e.labels?.[0]?.textContent ?? e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 50)}`));
console.log(page.url().replace(BASE, "")); console.log(fields.slice(0, 60).join("\n"));
process.exit(0);
