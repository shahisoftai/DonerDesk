import { attach } from "../demo-ui/lib.mjs";
import fs from "node:fs";
const { page, browser } = await attach("xl");
const b64 = await page.evaluate(async (id) => { const r = await fetch(`/api/reporting-periods/${id}/indicator-sheet/export`); const buf = new Uint8Array(await r.arrayBuffer()); let s = ""; for (const b of buf) s += String.fromCharCode(b); return r.status + ":" + btoa(s); }, "0c7387a8-805b-499f-8496-4d63b8267d56");
const [st, data] = [b64.split(":")[0], b64.slice(b64.indexOf(":") + 1)]; console.log("status", st);
fs.writeFileSync(process.env.S + "/apr-sheet.xlsx", Buffer.from(data, "base64"));
await browser.close(); process.exit(0);
