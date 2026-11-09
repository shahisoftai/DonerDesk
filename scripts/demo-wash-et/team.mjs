import { attach } from "../demo-ui/lib.mjs";
const T = [["Tigist Alemu","tigist.alemu@example.org","Project manager"],["Dawit Bekele","dawit.bekele@example.org","Monitoring and evaluation officer"],["Selam Tesfaye","selam.tesfaye@example.org","Grants officer"],["Abdi Hassan","abdi.hassan@example.org","Field officer"],["Hana Girma","hana.girma@example.org","Compliance officer"]];
const { page, browser } = await attach("team");
for (const [n,e,r] of T) {
  await page.getByLabel("Name", { exact: true }).fill(n); await page.getByLabel("Email (needed to invite)").fill(e);
  await page.getByLabel("Role", { exact: true }).selectOption({ label: r });
  await page.getByRole("button", { name: "Add to team" }).click(); await page.waitForTimeout(2500);
}
await page.getByLabel("There are no outside partners").check().catch(()=>console.log("partners checkbox?"));
await page.waitForTimeout(2000);
await page.screenshot({path:process.env.SHOT, fullPage:false});
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)[\s\S]{0,400}/)?.[0]);
await browser.close(); process.exit(0);
