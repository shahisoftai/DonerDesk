import fs from "node:fs";
import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const [email, role, outFile, partner] = process.argv.slice(2);
const { page, browser } = await attach("inv");
await page.goto(BASE + "/team", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
await page.getByRole("button", { name: "Invite member" }).click(); await page.waitForTimeout(800);
await page.locator("#invite-email").fill(email);
await page.locator("select").filter({ has: page.locator("option", { hasText: "Project Manager" }) }).first().selectOption({ label: role });
if (partner) { await page.getByLabel(/Outside partner/).check(); await page.waitForTimeout(800); console.log("partner fields:", (await page.locator("main").innerText()).replace(/\n+/g," / ").split("Outside partner")[1]?.slice(0,500)); }
if (partner) { await page.getByLabel(/DEMO-15/).check(); }
await page.getByRole("button", { name: "Send invite" }).click(); await page.waitForTimeout(3000);
const code = await page.locator("code").first().innerText().catch(()=>"");
console.log("LINK:", code); if (code) fs.writeFileSync(`${S}/${outFile}`, code.trim());
await browser.close(); process.exit(0);
