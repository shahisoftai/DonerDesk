import { IND, MONTHS } from "./data.mjs"; import { activities } from "./acts.mjs"; import { writeFileSync } from "node:fs";
writeFileSync("plan.json", JSON.stringify({ IND, MONTHS, acts: MONTHS.map((_, m) => activities(m)) }, null, 1));
