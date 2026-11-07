import { attach } from "./lib.mjs";
const { page, browser } = await attach("probe2");
const nav = page.getByRole("navigation", { name: "Create a project" });
const rail = async () => (await nav.getByRole("button",{name:/Results/}).innerText()).replace(/\n/g," ");
const slide = page.locator("section[aria-roledescription='slide']");
const rows = await slide.locator("li, article").filter({ has: page.locator("select") }).all();
const sel = rows[0].locator("select").first();
console.log(await rail());
await sel.selectOption({ label: "— none —" }); await page.waitForTimeout(1200); console.log("none:", await rail());
await sel.selectOption({ index: 1 }); await page.waitForTimeout(1200); console.log("back:", await rail(), await sel.evaluate(s=>s.selectedOptions[0].textContent.slice(0,30)));
// outcome row: goal parent toggle
const oc = rows[5].locator("select").first();
await oc.selectOption({ label: "— none —" }); await page.waitForTimeout(1200); console.log("outcome none:", await rail());
await oc.selectOption({ index: 1 }); await page.waitForTimeout(1200); console.log("outcome back:", await rail(), await oc.evaluate(s=>s.selectedOptions[0].textContent.slice(0,30)));
await browser.close();
