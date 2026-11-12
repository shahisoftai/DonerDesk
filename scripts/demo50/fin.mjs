import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("fin");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/finance", { waldUntil: "domcontentloaded" }).catch(()=>{}); await page.waitForTimeout(4500);
console.log("PAGE:", (await page.locator("main").innerText()).replace(/\n+/g," / ").replace(/^.*?Where the money stands/,"Where the money stands").slice(0,1500));
for (const b of ["Add funding", "Add an expense", "Record money received", "Record an advance", "Add a milestone", "Check the sheet"]) {
  const btn = page.getByRole("button", { name: new RegExp("^" + b) }).first();
  if (!(await btn.count())) { console.log("\n## " + b + ": NOT FOUND"); continue; }
  const before = await page.locator("main").innerText();
  await btn.click(); await page.waitForTimeout(900);
  const after = await page.locator("main").innerText();
  const lines = after.split("\n").filter((l) => !before.split("\n").includes(l)).map((l)=>l.trim()).filter(Boolean);
  console.log("\n## " + b + " -> new: " + lines.join(" | ").slice(0, 600));
}
await browser.close(); process.exit(0);
