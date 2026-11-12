import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("onb-do");
const S = process.env.S; const log = (...a) => console.log(...a);
page.on("pageerror", (e) => log("PAGEERROR", String(e).slice(0, 200)));
const status = async (label) => { const t = await page.locator("main").innerText(); log(label, "->", new URL(page.url()).pathname, "|", t.replace(/\s+/g," ").slice(0,160)); };
// Profile
await page.goto(BASE + "/onboarding/profile", { waitUntil: "networkidle" });
await page.locator("#org-website").fill("https://example.org");
await page.getByRole("button", { name: "Save settings" }).click();
await page.waitForTimeout(3000); await status("profile saved");
await page.screenshot({ path: S + "/03-profile.png", fullPage: true });
// Storage: DonorDesk storage
await page.goto(BASE + "/onboarding/storage", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Use DonorDesk storage" }).click();
await page.waitForTimeout(3000); await status("storage chosen");
// Reporting defaults
await page.goto(BASE + "/onboarding/reporting-defaults", { waitUntil: "networkidle" });
await page.locator("select[name=tone]").selectOption({ index: 1 });
await page.getByRole("button", { name: "Save defaults" }).click();
await page.waitForTimeout(3000); await status("defaults saved");
// Team: open the invite dialog only (no email sent)
await page.goto(BASE + "/onboarding/team", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Invite member" }).click();
await page.waitForTimeout(1500);
log("invite dialog open:", await page.getByRole("dialog").isVisible().catch(() => false));
await page.screenshot({ path: S + "/04-invite.png" });
await page.keyboard.press("Escape");
// Dashboard before terms: must go to onboarding
await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" }); await status("dashboard before terms");
// Terms
await page.locator("#legal-consent input[type=checkbox]").check();
await page.getByRole("button", { name: /Accept and finish setup/ }).click();
await page.getByText("Terms accepted").waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: S + "/05-terms.png", fullPage: true });
log((await page.locator("ol > li").allInnerTexts()).map(t=>t.replace(/\s+/g," ").slice(0,90)).join("\n"));
log("setup complete banner:", await page.getByText("Setup complete").isVisible().catch(()=>false));
// Dashboard after terms, soft and hard
await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" }); await status("dashboard after terms");
await page.screenshot({ path: S + "/06-dashboard.png" });
for (const p of ["/visuals","/portfolio","/help"]) { await page.goto(BASE + p, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500); log(p, "->", new URL(page.url()).pathname); }
await browser.close(); process.exit(0);
