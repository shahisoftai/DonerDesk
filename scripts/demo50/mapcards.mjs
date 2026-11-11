// Adds place figure cards and text cards to the map block through its Build tab fields.
import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("mapcards");
const map = page.locator('[data-kind="MAP"]').first(); await map.focus(); await map.press("Enter");
const edit = page.locator("#edit-drawer-shell");
await edit.locator('button[data-tab="BUILD"]').click();
const places = edit.getByLabel(/Figure cards beside these areas/);
await places.fill("Karnali\nSudurpashchim\nJumla\nDoti");
await places.press("Tab");
for (const [where, words] of [["Humla", "Road access to Simikot cut July–August; RUTF flown in."], ["Achham", "New stabilisation centre opened at the district hospital in January."]]) {
  await edit.getByRole("button", { name: "Add a text card" }).click();
  await page.waitForTimeout(400);
  await edit.getByLabel("Place it points at").last().fill(where);
  await edit.getByLabel("Words (up to 200 characters)").last().fill(words);
  await edit.getByLabel("Words (up to 200 characters)").last().press("Tab");
  await page.waitForTimeout(400);
}
console.log((await edit.locator('[role="status"]').allTextContents()).join(" | ").slice(0, 300));
await browser.close(); process.exit(0);
