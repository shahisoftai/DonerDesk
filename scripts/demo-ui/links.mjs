import { attach, BASE } from "./lib.mjs";
const { page } = await attach("links");
const id = process.argv[2];
await page.goto(`${BASE}/projects/${id}`); await page.waitForTimeout(3500);
console.log(await page.title(), (await page.locator("h1").first().innerText()).slice(0,80));
const l = await page.$$eval("a[href]", (as) => [...new Set(as.map((a) => a.getAttribute("href")))].filter((h) => h.includes("/projects/")));
console.log(l.map(x=>x.replace(id,":id")).join(" "));
process.exit(0);
