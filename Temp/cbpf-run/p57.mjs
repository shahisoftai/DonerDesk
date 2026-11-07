import { attach } from "./lib.mjs";
const { page, browser } = await attach("peek6");
const nav = page.getByRole("navigation", { name: "Create a project" });
const slide = page.locator("section[aria-roledescription='slide']");
for (const l of ["Work plan","Budget and finance"]) { await nav.getByRole("button",{name:new RegExp(l)}).click(); await page.waitForTimeout(800);
 console.log("==",l, "accept buttons:", await slide.getByRole("button",{name:/^(Accept|Confirm)$/}).count(), "confirm-all:", await page.getByRole("button",{name:/Confirm all/}).count());
 for (const r of await slide.locator("li, article").all()) { const ins = await r.locator("input").evaluateAll(i=>i.map(x=>x.value.slice(0,40)).filter(Boolean)); if (ins.length) console.log("  ", JSON.stringify(ins), (await r.innerText()).includes("From your document")?"[doc]":"", await r.getByRole("button",{name:/^(Accept|Confirm)$/}).count()?"[WAITING]":""); } }
await browser.close();
