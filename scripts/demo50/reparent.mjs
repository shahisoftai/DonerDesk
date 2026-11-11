import { attach } from "../demo-ui/lib.mjs";
const [name, parentPath] = [process.argv[2], process.argv[3]];
const { page, browser } = await attach("reparent");
await page.getByLabel("Search places").fill(name);
await page.waitForTimeout(1200);
const row = page.locator("tr, li").filter({ hasText: name }).filter({ has: page.getByRole("button", { name: /Pin|Change pin/ }) }).first();
console.log("row:", (await row.innerText()).replace(/\s+/g, " ").slice(0, 120));
await row.getByRole("button", { name: /Pin|Change pin/ }).click();
await page.waitForTimeout(1500);
const inside = page.getByRole("combobox", { name: "Inside" }).last();
if (!(await inside.count())) { console.log("NO Inside select in this release"); await browser.close(); process.exit(0); }
const opts = await inside.locator("option").allTextContents();
const want = opts.find((o) => o === parentPath) ?? opts.find((o) => o.startsWith(parentPath));
await inside.selectOption({ label: want });
const ed = page.getByRole("region").filter({ has: inside }).last(); await ed.getByRole("button", { name: /^Save/ }).first().click();
await page.waitForTimeout(3000);
console.log(name, "->", want, (await page.locator('[role="alert"]').allTextContents()).join("/"));
await browser.close(); process.exit(0);
