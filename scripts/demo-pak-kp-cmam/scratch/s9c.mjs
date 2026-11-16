import { attach } from "../lib.mjs";
const { page, shot, browser } = await attach("s9c");
page.setDefaultTimeout(15000);
const map = ["Nutrition supply receipt, storage and stock check - Upper Dir","MNP, IFA and MMN distribution - Upper Dir","Community MUAC screening and referral - Upper Dir","OTP treatment of SAM with RUTF - Mardan","IYCF counselling in communities - Mardan","Training of health staff in CMAM and IYCF - Upper Dir","Monthly district data review and report","A cost of the whole project"];
const sels = page.locator("main select").filter({ has: page.locator("option", { hasText: "A cost of the whole project" }) });
console.log(await sels.count());
for (let i = 0; i < map.length; i++) { await sels.nth(i).selectOption({ label: map[i] }); await page.waitForTimeout(500); }
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Still to answer")).slice(0, 400));
await browser.close();
