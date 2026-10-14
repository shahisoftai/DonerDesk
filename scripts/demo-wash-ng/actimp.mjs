import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, writeFileSync } from "node:fs"; import { activities } from "./plan8.mjs";
const P = readFileSync("pid.txt","utf8").trim(); const m = Number(process.argv[2]);
const q = s => `"${String(s ?? "").replace(/"/g,'""')}"`;
const rows = activities(m);
const csv = ["Activity Title,Activity Date,Location,Output Code,Indicator Code,Participants Total,Participants Male,Participants Female,Summary,Achievements,Challenges,Lessons Learned,Next Steps",
 ...rows.map(a => [q(a.title + (process.env.SUFFIX ?? "")), a.date, q(a.loc), a.node.replace(/^A/,""), a.ind ?? "", a.total ?? "", a.male ?? "", a.female ?? "", q(a.summary), q(a.achievements), q(a.challenges + " " + a.adapt), q(a.lessons), q(a.next) ].join(","))].join("\n") + "\n";
writeFileSync(`acts-m${m}.csv`, csv);
const { page, browser } = await attach("actimp");
await page.goto(`${BASE}/projects/${P}/activities/import`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1000);
await page.getByLabel("Or paste or dictate it here").fill(csv); await page.waitForTimeout(3500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").split("Create activity records")[0].slice(-1500));
if (process.argv[3] === "go") { await page.getByRole("button", { name: "Create activity records" }).click(); await page.waitForTimeout(9000); console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(-1500)); }
await browser.close(); process.exit(0);
