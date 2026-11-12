import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("kinds");
await page.goto(BASE + "/visuals/charts/14d6f13d-34ee-47ef-9d64-d16595e3e690", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(9000);
const names = await page.locator("main button, main label").evaluateAll(a=>a.map(x=>x.innerText.trim().replace(/\n/g," ")).filter(Boolean));
for (const k of ["Beeswarm","Violin","Ridgeline","Marimekko","Alluvial","Chord","Parliament","Proportion bar","Small multiples","Dot density","Hex","Bar race","Slope","Waterfall","Funnel","Gauge","Heatmap","Word cloud"]) console.log(k.padEnd(16), names.filter(n=>n.toLowerCase().includes(k.toLowerCase())).slice(0,3).join(" || ") || "— not found");
await browser.close(); process.exit(0);
