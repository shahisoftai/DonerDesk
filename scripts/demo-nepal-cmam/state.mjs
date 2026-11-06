import { attach } from "../demo-ui/lib.mjs"; import { readFileSync, writeFileSync } from "node:fs"; import { loadItems } from "./plan.mjs"; import { FULL } from "./plan9.mjs"; import { MS } from "./data.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("state");
const items = await loadItems(page, P); const out = {};
const EXTRA = { "Refresher meeting of mother support group leaders": "R", "Joint review with the district health office": "J", "Handover of registers to the health posts": "H" };
const nodeOf = (t) => EXTRA[t] ?? Object.entries(FULL).find(([, v]) => v === t)?.[0];
for (const i of items) { const m = MS.findIndex((a) => new RegExp(`\\b\\d{1,2} ${a}\\b`).test(i.line)); const n = nodeOf(i.title); if (n && m >= 0) out[`${n}:${m}`] = i.href; }
writeFileSync("plan-state.json", JSON.stringify(out, null, 1)); console.log(Object.keys(out).length, "planned items mapped");
await browser.close(); process.exit(0);
