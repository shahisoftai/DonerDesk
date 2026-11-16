import { attach } from "../lib.mjs";
const { page, browser } = await attach("v58e");
console.log(page.url());
const arts = await page.locator("main article").count(); console.log("articles", arts);
const resp = []; page.on("response", async r => { if (/project-setup\/drafts\/[^/]+$/.test(r.url()) && r.request().method() === "GET") { try { const j = await r.json(); resp.push(j); } catch {} } });
await page.reload(); await page.waitForTimeout(5000);
const j = resp[0]; const plan = j?.plan ?? j?.value?.plan; console.log("plan items:", plan?.length, JSON.stringify(plan?.[0]?.value ?? Object.keys(j ?? {})).slice(0, 400));
await browser.close();
