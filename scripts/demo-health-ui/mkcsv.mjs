import { IND } from "./data.mjs"; import { writeFileSync } from "node:fs";
const q = s => `"${String(s).replace(/"/g,'""')}"`;
const lines = ["Code,Name,Type,Baseline,Target,Unit,Means of Verification,Data Source,Frequency,Disaggregation Required,Logframe Code"];
for (const i of IND) { if (i[0]==="HL-2.3b") continue; lines.push([i[0],q(i[1]),i[2],i[3],i[4],q(i[5]),q(i[6]),q(i[7]),i[8],i[9],i[10]].join(",")); }
writeFileSync("indicators.csv", lines.join("\n")+"\n"); console.log(lines.length-1);
