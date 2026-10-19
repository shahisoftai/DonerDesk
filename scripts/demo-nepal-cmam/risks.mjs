import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("risks");
const R = {
  1: ["Three health posts ran out of therapeutic food for nine days", "It has happened", "High", "Bikash", "Redistribute stock between posts, agree a fortnightly delivery schedule with the district health office and keep a buffer of one carton per ten children."],
  2: ["Monsoon floods may cut access to four outreach sites", "It might happen", "Medium", "Sunita", "Pre-position a month of therapeutic food at the four posts and agree an alternative route by tractor with the municipality."],
};
for (const k of process.argv.slice(2)) {
  const [title, kind, sev, who, action] = R[k];
  await page.goto(`${BASE}/projects/${P}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Raise a problem" }).click(); await page.waitForTimeout(600);
  await page.getByLabel("What is it?").fill(title); await page.getByLabel("Has it happened?").selectOption({ label: kind }); await page.getByLabel("How serious?").selectOption({ label: sev });
  const w = page.getByLabel("Who is handling it?"); await w.selectOption({ label: (await w.locator("option").allInnerTexts()).find(o => o.includes(who)) });
  await page.getByLabel("What are we doing about it?").fill(action);
  await page.getByRole("button", { name: "Raise it" }).click(); await page.waitForTimeout(3500);
  const t = await page.locator("main").innerText(); console.log("raised", k, "|", t.replace(/\n+/g, " | ").match(/Problems and risks[^|]*\|[^|]*\|[^|]*\|[^|]*/)?.[0]);
}
await browser.close(); process.exit(0);
