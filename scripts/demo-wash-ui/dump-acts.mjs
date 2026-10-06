import { activities } from "./acts.mjs"; import { D, MONTHS } from "./data.mjs"; import { writeFileSync } from "node:fs";
const out = []; for (let m = 0; m < 6; m++) for (const a of activities(m)) out.push({ m, month: MONTHS[m], ...a });
writeFileSync("acts.json", JSON.stringify({ acts: out, D }, null, 1)); console.log(out.length);
