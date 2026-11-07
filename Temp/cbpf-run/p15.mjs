import { attach } from "./lib.mjs";
const { page, browser, shot, step, type } = await attach("places");
const slide = page.locator("section[aria-roledescription='slide']");
for (const name of ["Baydhaba", "Baydhaba", "Baidoa District"]) {
  await step("remove " + name, async () => {
    const rows = await slide.locator("li, article").all();
    for (const r of rows) { const v = await r.locator("input").first().inputValue().catch(()=>null); if (v === name) { await r.getByRole("button",{name:"Remove"}).click(); await page.waitForTimeout(800); return; } }
    throw new Error("row not found " + name);
  });
}
await step("confirm all", async () => { const b = page.getByRole("button",{name:/Confirm all \d+ that are waiting/}); if (await b.count()) await b.click(); await page.waitForTimeout(800); });
const rows = await slide.locator("li, article").all();
for (const r of rows) console.log(JSON.stringify(await r.locator("input").evaluateAll(i=>i.map(x=>x.value))), JSON.stringify(await r.locator("select").evaluateAll(s=>s.map(x=>x.selectedOptions[0]?.textContent))));
const pa = slide.getByLabel("Project area", {exact:true});
console.log("project-area control:", await pa.count(), await slide.innerText().then(t=>t.match(/Project area[\s\S]{0,120}/)?.[0]));
console.log((await page.getByRole("navigation", { name: "Create a project" }).innerText()).replace(/\n/g," | ").slice(0,200));
await browser.close();
