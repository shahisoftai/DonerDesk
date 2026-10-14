import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, appendFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("newperiod");
const [type, tpl, start, end] = process.argv.slice(2);
await page.goto(`${BASE}/projects/${P}/reports/new`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
await page.getByLabel("Report type").selectOption({ label: type }); await page.waitForTimeout(1200);
console.log("auto template:", await page.getByLabel("Donor template").locator("option:checked").innerText(), "| dates:", await page.getByLabel("Start date").inputValue(), await page.getByLabel("End date").inputValue(), "| panel:", (await page.locator("main").innerText()).replace(/\n+/g," | ").match(/What you can create[^$]{0,900}/)?.[0]);
if (tpl) await page.getByLabel("Donor template").selectOption({ label: tpl });
if (start) { await page.getByLabel("Start date").fill(start); await page.getByLabel("End date").fill(end); }
console.log("final dates:", await page.getByLabel("Start date").inputValue(), await page.getByLabel("End date").inputValue(), "deadline", await page.getByLabel("Donor deadline").inputValue());
if (process.argv[6] === "go") { await page.getByRole("button", { name: "Create period" }).click(); await page.waitForTimeout(5000); console.log(page.url()); const m = page.url().match(/reports\/([0-9a-f-]{36})/); if (m && !process.env.NOLOG) appendFileSync("periods.txt", m[1] + "\n"); console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,400)); }
await browser.close(); process.exit(0);
