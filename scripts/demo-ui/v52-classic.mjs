import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-classic");
const S = process.env.OUT;
await page.goto(BASE + "/projects/new/classic", { waitUntil: "networkidle" });
const dump = async (n) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${S}/8-classic-${n}.png`, fullPage: true });
  const f = await page.$$eval("main input, main select, main textarea, main button", (els) => els.filter((e) => e.offsetParent).map((e) => `${e.tagName.toLowerCase()}:${e.type} id=${e.id} val=${(e.value ?? "").slice(0, 30)} label=${(e.labels?.[0]?.textContent ?? e.textContent ?? "").trim().slice(0, 45)}`));
  console.log(`--- step ${n} ${page.url().replace(BASE, "")}\n` + f.join("\n"));
};
const stamp = Date.now().toString().slice(-6);
await page.fill("#title", `ZZ TEST Phase 52 framework check ${stamp}`);
await page.fill("#projectCode", `ZZ52-${stamp}`);
await page.fill("#donorName", "ZZ Test Donor");
await page.fill("#implementingOrganization", "Global Care Initiative");
await page.getByRole("button", { name: /^next$/i }).click();
await dump(2);
process.exit(0);
