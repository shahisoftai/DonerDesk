import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-risk3");
await page.goto(`${BASE}/projects/${process.env.T}`, { waitUntil: "networkidle" });
const card = page.locator("section[aria-labelledby=risks-title]");
console.log((await card.innerText()).slice(0, 500));
await card.screenshot({ path: process.env.OUT + "/20-risk-listed.png" });
process.exit(0);
