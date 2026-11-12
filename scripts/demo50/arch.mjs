import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("arch");
await page.goto(BASE + "/projects/8f4e405d-36fc-4066-8c6c-4139e459426e/settings", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
page.on("dialog", d => d.accept());
await page.getByRole("button", { name: "Archive project" }).click(); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").slice(-700));
const confirm = page.getByRole("button", { name: /Archive|Confirm|Yes/ }).last(); console.log("buttons:", (await page.locator("main button:visible, [role=dialog] button:visible").allInnerTexts()).join(" | "));
await browser.close(); process.exit(0);
