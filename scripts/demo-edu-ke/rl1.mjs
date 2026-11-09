import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rl1"); page.setDefaultTimeout(15000);
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/activities/8a17f1c6-eac8-414b-bd7c-5028ba2f65db", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
await page.getByRole("button", { name: /^Reopen for correction/ }).click(); await page.waitForTimeout(1200);
await page.getByLabel("What needs to be corrected?").fill("Link this record to its planned activity.").catch(async()=>page.locator("#reopenNote, [name=reopenNote]").first().fill("Link this record to its planned activity.")); 
await page.getByRole("button", { name: "Send back for correction" }).click(); await page.waitForTimeout(5000);
console.log(page.url()); const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Radio and digital")).slice(0,500).replace(/\n+/g," | "));
console.log(await page.evaluate(() => [...document.querySelectorAll("main a, main button")].map(b=>b.innerText.trim()).filter(x=>/edit|correct|submit|accept|plan/i.test(x)).slice(0,10)));
await browser.close(); process.exit(0);
