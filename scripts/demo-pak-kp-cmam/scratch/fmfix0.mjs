import { attach } from "../lib.mjs";
const { page, browser } = await attach("fmfix0");
page.setDefaultTimeout(20000);
await page.goto("https://donordesk.online/projects/" + (await import("node:fs")).readFileSync(new URL("../pid.txt", import.meta.url), "utf8").trim() + "/forms/5357fae0-c0b5-44d4-a264-d9edb00101ec"); await page.waitForTimeout(3000); await page.getByText("Edit the questions").first().click(); await page.waitForTimeout(1500);
const d = page.getByLabel("The date that decides the period", { exact: true }); const n = await d.count(); console.log(n);
for (let i = 0; i < n; i++) await d.nth(i).selectOption({ label: "Reporting month end date" });
await page.getByRole("button", { name: "Save the draft" }).click(); await page.waitForTimeout(3000); console.log("saved");
await browser.close();
