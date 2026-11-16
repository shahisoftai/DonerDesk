import { attach } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, type, step, browser } = await attach("s2");
const meta = JSON.parse(readFileSync(new URL("../inputs/meta.json", import.meta.url)));
await page.getByRole("button", { name: /^2\. / }).first().click(); await page.waitForTimeout(1000);
await step("details", async () => {
  await type("Project name", "[DEMO-17] CMAM and IYCF in Upper Dir and Mardan, Khyber Pakhtunkhwa, Pakistan");
  await type("Project code", "PAK-KP-CMAM-2026");
  await type("Start date", "2026-11-01"); await type("End date", "2027-04-30"); await type("Currency (for example USD)", "USD");
  await type("Short summary", "Six-month UNICEF-funded programme delivering community-based management of acute malnutrition (OTP, SFP, stabilisation centres), PLW screening, IYCF counselling and micronutrient supplementation in Upper Dir and Mardan districts, with monthly reporting by place and sex.");
});
for (const [name, email, role] of meta.team) {
  await step("team " + name, async () => {
    await type("Name", name, page.locator("main")); await type("Email (needed to invite)", email);
    await page.getByLabel("Role", { exact: true }).selectOption({ label: role });
    await page.getByLabel("Invitation", { exact: true }).selectOption({ label: "Invite later" });
    await page.getByRole("button", { name: "Add to team" }).click(); await page.waitForTimeout(1200);
  });
}
await step("no partners", async () => { await page.getByLabel("There are no outside partners").check(); });
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Team"), t.indexOf("Team") + 1500)); console.log(t.slice(t.indexOf("Still to answer")).slice(0, 500));
await browser.close();
