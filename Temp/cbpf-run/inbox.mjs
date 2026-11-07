import { attach } from "./lib.mjs";
const { page, browser } = await attach("inbox");
const id = new URL(page.url()).searchParams.get("id");
const r = await page.evaluate(async (id) => { for (const p of [`/api/v1/project-setup/drafts/${id}`, `/v1/project-setup/drafts/${id}`, `/api/proxy/v1/project-setup/drafts/${id}`]) { const x = await fetch(p, { credentials: "include" }); if (x.ok && /json/.test(x.headers.get("content-type")||"")) return { p, j: await x.json() }; } return null; }, id);
if (!r) { console.log("no api access from page"); } else {
  const v = r.j.data ?? r.j; console.log(r.p, Object.keys(v));
  console.log((v.inbox ?? []).map((g) => `${g.slide}: ${g.code} ${JSON.stringify(g.params ?? {})} item=${g.itemKey ?? ""}`).join("\n"));
}
await browser.close();
