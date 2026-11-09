import { attach } from "../demo-ui/lib.mjs";
const D = [ // code, period, cumulative, source
["OP1-1a","2200","2200","Registration database export, 28 Nov 2026"],
["OP1-1b","1640","1640","Distribution lists, Maiduguri, Bama, Monguno, 16-22 Nov"],
["OP1-1c","62300","62300","Payment reports (mobile money), Nov cycle"],
["OP1-1d","82","","PDM survey, 214 respondents, 25-27 Nov"],
["OP1-2a","1480","1480","MUAC screening registers, 5 sites"],
["OP1-2b","96","96","Referral slips, stabilisation centres"],
["OP1-2c","640","640","Session attendance sheets"],
["OP2-1a","520","520","Seed distribution lists, Mubi"],
["OP2-1b","380","380","Farmer field school registers, Mubi"],
["OP2-2a","14","14","VSLA formation records, Potiskum"],
["OP2-2b","0","0","Grants start in December (no payments in November)"],
["OP3-1a","4150","4150","Cash-for-work attendance sheets, Bama"],
["OP3-1b","3","3","Completion certificates, Bama"],
];
const { page, browser } = await attach("nov");
for (const [code, p, c, src] of D) {
  const row = page.locator("tr", { has: page.locator("td", { hasText: new RegExp("^" + code + "$") }) }).first();
  const inputs = row.locator("input"); const n = await inputs.count();
  if (code === "OP1-1a") console.log("inputs per row", n, await inputs.evaluateAll((l) => l.map((i) => i.placeholder + "/" + i.type)));
  await inputs.nth(0).fill(p); if (c) await inputs.nth(1).fill(c); await inputs.nth(n - 1).fill(src);
}
await page.waitForTimeout(1000); await page.screenshot({ path: process.env.SHOT });
await browser.close(); process.exit(0);
