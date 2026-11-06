// Simplicity measures per role (plan 28.12): where each person lands, how many things they can click on that page,
// how many sidebar items they have, what their first useful action is and how many clicks it takes. Screenshots per role.
import { attach, BASE } from "../demo-ui/lib.mjs"; import { asUser } from "./asuser.mjs"; import { PEOPLE } from "./data.mjs"; import { writeFileSync } from "node:fs";
const { browser } = await attach("measure"); const rows = [];
for (const p of PEOPLE) {
  const { ctx, page } = await asUser(browser, p.email);
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
  const landing = page.url().replace(BASE, "");
  const nav = await page.locator("aside a, nav a").evaluateAll((a) => [...new Set(a.map((x) => x.innerText.trim()).filter(Boolean))]);
  const inMain = await page.locator("main").evaluate((m) => ({ buttons: [...m.querySelectorAll("button")].filter((b) => b.offsetParent).length, links: [...m.querySelectorAll("a")].filter((b) => b.offsetParent).length, text: m.innerText.replace(/\n+/g, " | ").slice(0, 160) }));
  await page.screenshot({ path: `shot-role-${p.role}.png` });
  rows.push({ person: p.name, role: p.role, landing, sidebarItems: nav.length, sidebar: nav.join(", "), buttonsOnLanding: inMain.buttons, linksOnLanding: inMain.links, sample: inMain.text });
  await ctx.close();
}
writeFileSync("measures.json", JSON.stringify(rows, null, 1)); console.log(JSON.stringify(rows, null, 1));
await browser.close(); process.exit(0);
