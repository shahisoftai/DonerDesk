import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("pub4");
await page.goto(BASE + "/visuals/fee3d075-90d6-4c46-b028-09e0d812852a", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2000);
const r = await page.request.get(BASE + "/api/canvases/fee3d075-90d6-4c46-b028-09e0d812852a/exports/6d39bb8e-56c5-4696-b45a-a2bad594608d/file");
const b = await r.body(); console.log(r.status(), r.headers()["content-type"], b.length, "bytes", b.subarray(0,5).toString());
await browser.close(); process.exit(0);
