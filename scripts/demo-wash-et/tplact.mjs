import { attach } from "../demo-ui/lib.mjs";
import fs from "node:fs";
const { page, browser } = await attach("tplact");
const b64 = await page.evaluate(async () => { const r = await fetch("/api/templates/activities"); const buf = new Uint8Array(await r.arrayBuffer()); let s = ""; for (const b of buf) s += String.fromCharCode(b); return btoa(s); });
fs.writeFileSync(process.env.S + "/act-template.xlsx", Buffer.from(b64, "base64"));
await browser.close(); process.exit(0);
