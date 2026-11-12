import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("wd2");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/activities/6a1bd830-a4cf-4c6d-aac4-ac23898fc726", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).match(/Accepted|Withdrawn|Submitted/g)?.slice(0,3));
console.log((await page.locator("[role=alert],[role=status]").allInnerTexts()).join("|"));
await browser.close(); process.exit(0);
