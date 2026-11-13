import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-recheck");
const S = process.env.OUT;
// 1. DEMO-15 Logframe lens: OC1 before OC2.
await page.goto(`${BASE}/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/logframe?view=LOGFRAME`, { waitUntil: "networkidle" });
const codes = await page.$$eval("tbody tr td:nth-child(2)", (tds) => tds.map((t) => t.textContent.trim()).filter(Boolean));
console.log("1. result order:", codes.join(" "));
await page.screenshot({ path: `${S}/26-lens-order.png` });
// 2. Risk names its result.
await page.goto(`${BASE}/projects/71029820-042e-41e7-83c0-d91b9f451c1d`, { waitUntil: "networkidle" });
const card = await page.locator("section[aria-labelledby=risks-title]").innerText();
console.log("2. risk line:", (card.match(/Affects: [^\n]+/) ?? ["NOT SHOWN"])[0]);
// 3. Wizard row: logic after the buttons.
await page.goto(`${BASE}/projects/new/wizard?id=cff39ad8-7b12-4231-894b-901649837870`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^3\. Results framework/ }).click();
await page.waitForTimeout(1500);
const order = await page.locator("li").filter({ hasText: "ZZ TEST specific aim" }).first().evaluate((li) => [...li.querySelectorAll("button, details")].map((e) => e.tagName === "DETAILS" ? "LOGIC" : e.textContent.trim()).join(" > "));
console.log("3. row order:", order);
await page.screenshot({ path: `${S}/27-wiz-row.png` });
process.exit(0);
