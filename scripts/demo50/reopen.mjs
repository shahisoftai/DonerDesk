import { attach, BASE } from "../demo-ui/lib.mjs";
const P = "14d6f13d-34ee-47ef-9d64-d16595e3e690";
const periods = ["e8df4e42-7295-4f43-b34b-1018f2b4275f", "0b4c8842-59cd-4650-8140-99e0f7ef344e", "bf4ea326-f877-4bfb-9d59-e08e63dd3f76", "064ad3b8-e6e0-4501-a62f-736d0e251989", "607f5698-0185-402d-9b43-d3d992c0f0c0", "0c7387a8-805b-499f-8496-4d63b8267d56"];
const { page, browser } = await attach("reopen");
for (const id of periods) {
  await page.goto(`${BASE}/projects/${P}/reports/${id}/inputs`, { waitUntil: "domcontentloaded" });
  const btn = page.getByRole("button", { name: /^Reopen verified \(\d+\)$/ });
  try { await btn.waitFor({ timeout: 20000 }); } catch { console.log(id, "no verified values to reopen"); continue; }
  const label = await btn.innerText();
  await btn.click();
  await page.getByLabel("Why the values are being reopened").fill("Adding the district breakdown (Location) the cluster dashboard needs; figures unchanged.");
  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  await page.waitForTimeout(4000);
  console.log(id, label, "->", (await page.locator('[role="status"],[role="alert"]').allTextContents()).join(" / ").slice(0, 160));
}
await browser.close(); process.exit(0);
