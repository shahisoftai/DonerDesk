import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-risk2");
await page.goto(`${BASE}/projects/${process.env.T}`, { waitUntil: "networkidle" });
const t = await page.evaluate(() => document.body.innerText);
const i = t.indexOf("Problems and risks");
console.log(t.slice(i, i + 400));
process.exit(0);
