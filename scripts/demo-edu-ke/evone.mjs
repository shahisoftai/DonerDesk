import { attach } from "../demo-ui/lib.mjs"; import fs from "node:fs";
const { page, browser } = await attach("evone"); page.setDefaultTimeout(20000);
const man = JSON.parse(fs.readFileSync(process.env.S + "/evi/manifest.json", "utf8"));
const [from, to] = [Number(process.argv[2] ?? 0), Number(process.argv[3] ?? 1)];
for (const it of man.slice(from, to)) {
  await page.goto('https://donordesk.online/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/evidence', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000); await page.getByRole('button', { name: /Upload evidence/ }).first().click().catch(()=>page.getByText('Upload evidence').first().click()); await page.waitForTimeout(2000);
  const sel = (lab) => page.getByLabel(lab, { exact: true }).first();
  await sel("Evidence type").selectOption({ label: it.type });
  await sel("Confidentiality").selectOption({ label: "Internal" });
  const ind = sel("Indicator"); const o = await ind.locator("option").allTextContents(); await ind.selectOption({ label: o.find((x) => x.startsWith(it.code + " ")) });
  const mon = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"][Number(it.month.slice(5))];
  const act = sel("Activity"); const ao = await act.locator("option").allTextContents(); const T = {"OP2-1a":"Teacher training on","OP1-2c":"Scholastic kit","OP3-1a":"School management committee","OP1-1a":"Community enrolment drive"}[it.code]; const pick = ao.find((x) => x.startsWith(T) && x.includes(mon + " 2026")); if (pick) await act.selectOption({ label: pick });
  await page.getByLabel("Notes", { exact: true }).fill(`Synthetic record for ${it.code}, ${it.month}.`);
  await page.locator("input[type=file]").first().setInputFiles(it.file); await page.waitForTimeout(1200);
  const btn = page.getByRole("button", { name: /^(Upload|Save|Add)/ }); console.log(await btn.allInnerTexts());
  await btn.last().click(); await page.waitForTimeout(9000);
  console.log(it.month, it.code, (await page.locator("main").innerText()).match(/\d+ file\(s\)|Uploaded[^\n]*|[^\n]*error[^\n]*/gi)?.slice(0,3));
}
await browser.close(); process.exit(0);
