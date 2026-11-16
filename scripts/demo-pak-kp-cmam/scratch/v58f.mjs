import { attach } from "../lib.mjs";
const { page, browser } = await attach("v58f");
const id = new URL(page.url()).searchParams.get("id");
const r = await page.evaluate(async (id) => { const x = await fetch("/api/proxy/v1/project-setup/drafts/" + id); const t = await x.text(); return [x.status, t.slice(0, 200)]; }, id);
console.log(r);
const r2 = await page.evaluate(async (id) => { const x = await fetch("/api/v1/project-setup/drafts/" + id); const t = await x.text(); let j; try { j = JSON.parse(t); } catch {} return [x.status, j ? JSON.stringify((j.plan ?? j.value?.plan)?.[0]?.value) : t.slice(0, 200)]; }, id);
console.log(r2);
await browser.close();
