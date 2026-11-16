import { attach, BASE } from "../lib.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const { page, shot, browser } = await attach("tm3");
page.setDefaultTimeout(20000);
const meta = JSON.parse(readFileSync(new URL("../inputs/meta.json", import.meta.url)));
const roleMap = { "Project manager": "Project Manager", "Monitoring and evaluation officer": "M&E Officer", "Grants officer": "Grants Officer", "Field officer": "Field Officer", "Compliance officer": "Compliance Officer", "Viewer": "Viewer" };
const out = [];
for (const [name, email, role] of meta.team) {
  await page.goto(`${BASE}/team`); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Invite member" }).click(); await page.waitForTimeout(800);
  await page.locator("input[type=email]").fill(email);
  await page.getByLabel("Role", { exact: true }).first().selectOption({ label: roleMap[role] });
  await page.getByLabel(/\[DEMO-17\]/).check();
  await page.getByRole("button", { name: "Send invite" }).click(); await page.waitForTimeout(3500);
  const t = await page.locator("main").innerText(); const m = t.match(/https?:\/\/\S*invit\S*/i) || t.match(/\/invite\S*/i);
  console.log(name, "->", m ? m[0] : t.slice(0, 160).replace(/\n/g, " ")); out.push([name, email, m ? m[0] : ""]);
}
writeFileSync(new URL("../invites.json", import.meta.url), JSON.stringify(out, null, 1));
await shot("team-invited"); await browser.close();
