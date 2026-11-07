import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach("look2");
const id = process.argv[2];
await page.goto(`${BASE}/projects/new/wizard?id=${id}`); await page.waitForSelector("h1"); await page.waitForTimeout(1500);
const nav = page.getByRole("navigation", { name: "Create a project" });
for (const s of ["Project and team","Indicators","Places","Budget and finance","Work plan","Results framework"]) {
  await nav.getByRole("button", { name: new RegExp(s) }).click(); await page.waitForTimeout(800);
  const vals = await page.locator("main input, main textarea, main select").evaluateAll((els) => els.map((e) => `${e.getAttribute("aria-label") ?? e.id ?? ""}=${e.tagName === "SELECT" ? e.options[e.selectedIndex]?.text : e.value}`).filter((x) => !/=$|=— (choose|none|not sure) —$/.test(x)));
  console.log(`[${s}]`, vals.join(" | ").slice(0, 900));
  for (const d of await page.locator("main details").all()) { await d.locator("summary").click().catch(() => {}); }
  const left = await page.locator("main details").allInnerTexts();
  if (left.length) console.log("   details:", left.join(" // ").replace(/\s+/g, " ").slice(0, 700));
}
await browser.close().catch(() => {});
