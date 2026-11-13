import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-classic2");
const S = process.env.OUT;
const vals = { startDate: "2026-01-01", endDate: "2026-12-31" };
for (let n = 2; n <= 8; n += 1) {
  for (const [id, v] of Object.entries(vals)) if (await page.locator(`#${id}`).isVisible().catch(() => false)) await page.fill(`#${id}`, v);
  const btns = await page.$$eval("main button", (b) => b.filter((e) => e.offsetParent).map((e) => e.textContent.trim()));
  const fields = await page.$$eval("main input, main select, main textarea", (els) => els.filter((e) => e.offsetParent).map((e) => `${e.tagName.toLowerCase()}:${e.type} id=${e.id} val=${(e.value ?? "").slice(0, 25)} label=${(e.labels?.[0]?.textContent ?? "").trim().slice(0, 40)}`));
  console.log(`--- step ${n}: buttons=${btns.join(" | ")}\n${fields.join("\n")}`);
  await page.screenshot({ path: `${S}/8-classic-${n}.png`, fullPage: true });
  const create = btns.find((b) => /create|finish|save project/i.test(b));
  if (create) { console.log("STOP at create button:", create); break; }
  await page.getByRole("button", { name: /^next$/i }).click();
  await page.waitForTimeout(900);
}
process.exit(0);
