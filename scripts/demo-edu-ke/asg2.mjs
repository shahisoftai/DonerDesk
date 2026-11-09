import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("asg2"); page.setDefaultTimeout(15000);
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/team", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500); await page.getByRole("button", { name: "Assign member" }).first().click(); await page.waitForTimeout(1200);
await page.getByLabel("assign-user").selectOption({ index: 1 }).catch(async()=>page.locator("#assign-user").selectOption({ index: 1 }));
await page.locator("#assign-role").selectOption({ label: "Project Manager" });
await page.locator("#assign-role").locator("xpath=ancestor::*[.//button][1]").getByRole("button").first().click(); await page.waitForTimeout(4000);
console.log((await page.locator("main").innerText()).match(/\d+ active member\(s\)[^\n]*/)?.[0]);
// bulk lead for all plan items
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/activities", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
await page.getByRole("button", { name: "List", exact: true }).first().click().catch(()=>{}); await page.waitForTimeout(2000);
const cbs = page.locator("main input[type=checkbox][aria-label^='Select ']"); const n = await cbs.count(); for (let i = 0; i < n; i++) await cbs.nth(i).check();
const lead = page.locator("#bulk-lead"); console.log([...await lead.locator("option").allTextContents()]);
await lead.selectOption({ index: 2 }); await page.getByRole("button", { name: "Preview lead" }).click(); await page.waitForTimeout(2500);
console.log(await page.evaluate(() => [...document.querySelectorAll("main button")].map(b=>b.innerText.trim()).filter(x=>/apply|confirm|save|change/i.test(x))));
await browser.close(); process.exit(0);
