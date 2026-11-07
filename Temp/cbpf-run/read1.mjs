// Uploads the proposal N times with nothing typed, and prints what the wizard shows on its own.
import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach("read3");
await page.goto(BASE + "/");
if (/login/.test(page.url())) { await page.getByLabel("Email").fill(process.env.DD_EMAIL); await page.getByLabel("Password").fill(process.env.DD_PASS); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 30000 }); }
for (let n = 1; n <= 1; n++) {
  await page.goto(BASE + "/projects/new/wizard?new=1"); await page.waitForURL(/wizard\?id=/, { timeout: 60000 }); await page.waitForSelector("h1");
  const before = page.url();
  await page.locator("#pcw-file").setInputFiles("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/Temp/CBPF-SOM-25-S-NGO-37159.docx");
  await page.getByRole("button", { name: "Read my documents" }).click();
  await page.waitForURL((u) => u.href !== before, { timeout: 90000 });
  await page.getByText(/Reading your documents/).first().waitFor({ timeout: 30000 }).catch(() => {});
  const t0 = Date.now();
  while (await page.getByText(/Reading your documents/).count() && Date.now() - t0 < 300000) await page.waitForTimeout(3000);
  console.log(`RUN ${n} id=${new URL(page.url()).searchParams.get("id")} read=${Math.round((Date.now() - t0) / 1000)}s`);
  await page.reload(); await page.waitForSelector("h1"); await page.waitForTimeout(1500);
  const nav = page.getByRole("navigation", { name: "Create a project" });
  await nav.getByRole("button", { name: /Start/ }).click(); await page.waitForTimeout(600);
  console.log(" start:", await page.getByLabel("Donor", { exact: true }).inputValue(), "|", await page.getByLabel("Sector", { exact: true }).inputValue(), "|", await page.getByLabel("Country", { exact: true }).inputValue());
  console.log(" rail:", (await nav.innerText()).replace(/\n/g, " ").slice(0, 300));
  console.log(" alerts:", (await page.locator("[role=alert]").allInnerTexts()).filter(Boolean).join(" / ").slice(0, 300));
}
await browser.close();
