import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("form2");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/forms/new", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByLabel("Form name").fill("ZZ TEST water points checked");
await page.getByRole("button", { name: "Add a question" }).click(); await page.waitForTimeout(1000);
await page.getByLabel("Question 1", { exact: true }).fill("How many water points did you check?");
await page.getByRole("button", { name: "Add an indicator" }).click(); await page.waitForTimeout(1000);
const sels = page.locator("main select:visible"); const n = await sels.count();
for (let i = 0; i < n; i++) { const o = await sels.nth(i).locator("option").allInnerTexts(); if (o.some(x=>/OP1-1a/.test(x))) { await sels.nth(i).selectOption({ label: o.find(x=>/^OP1-1a/.test(x)) }); } }
await page.waitForTimeout(1000);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("Indicator /"); console.log("MAP AFTER:", t.slice(t.indexOf("Choose an indicator")-50>0?0:0).slice(-700));
console.log("BTNS:", (await page.locator("main button:visible").allInnerTexts()).join(" | "));
await page.getByRole("button", { name: "Save the draft" }).click(); await page.waitForTimeout(4000);
console.log("ALERTS:", (await page.locator("[role=alert], [class*=danger], [class*=error], .text-red-600, .text-danger-600").allInnerTexts()).join(" | "));
await page.screenshot({ path: "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad/form2.png", fullPage: true });
console.log("AFTER SAVE:", new URL(page.url()).pathname.replace(/[0-9a-f-]{36}/g,":id"), "|", (await page.locator("main").innerText()).replace(/\n+/g," / ").replace(/^.*Templates \/ Team \/ Settings/,"").slice(0,600));
console.log("BTNS:", (await page.locator("main button:visible, main a:visible").allInnerTexts()).join(" | ").slice(0,500));
await browser.close(); process.exit(0);
