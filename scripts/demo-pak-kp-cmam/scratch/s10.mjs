import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("s10");
page.setDefaultTimeout(15000);
await page.getByRole("button", { name: /^10\. / }).first().click(); await page.waitForTimeout(1000);
const R = [
["It might happen","Winter snow and landslides cut roads in Upper Dir, delaying RUTF delivery and caregiver attendance","High"],
["It might happen","Flooding or displacement in Mardan raises admissions beyond site capacity","Medium"],
["It might happen","Turnover of lady health workers reduces MUAC screening coverage","Medium"],
["It might happen","RUTF sharing within households slows recovery of children with SAM","Low"],
["It might happen","Stock-out of RUTF or RUSF at tehsil stores during winter","High"],
["It has happened","Late monthly reports from remote Upper Dir sites in the previous cycle","Low"],
["We are assuming","The Nutrition Directorate keeps OTP, SFP and SC sites open and staffed",""],
["We are assuming","The UNICEF supply pipeline delivers RUTF, RUSF and MNP on schedule",""],
];
const fs = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Add a risk or assumption" }) });
const scope = (await fs.count()) ? fs : page.locator("main");
for (const [k, w, s] of R) {
  await scope.getByLabel("What it is", { exact: true }).selectOption({ label: k }); await page.waitForTimeout(200);
  const b = scope.getByLabel("What it is about", { exact: true }); await b.fill(w); await b.press("Tab");
  if (s) await scope.getByLabel("How serious", { exact: true }).selectOption({ label: s });
  await page.getByRole("button", { name: "Add a risk or assumption" }).last().click(); await page.waitForTimeout(1800);
}
await page.getByLabel("Dashboard", { exact: true }).selectOption({ label: "Nutrition: screening and treatment" }); await page.waitForTimeout(1000);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Risks and assumptions"), t.indexOf("Risks and assumptions") + 1200)); console.log(t.slice(t.indexOf("Still to answer")).slice(0, 400));
await shot("s10"); await browser.close();
