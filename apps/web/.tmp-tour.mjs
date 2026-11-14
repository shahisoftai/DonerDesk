import { chromium } from "@playwright/test";
const out = process.argv[2]; const pages = process.argv.slice(3);
const b = await chromium.connectOverCDP("http://127.0.0.1:9340");
const p = b.contexts()[0].pages()[0];
for (const spec of pages) {
  const [name, path] = spec.split("=");
  await p.goto("https://donordesk.online" + path, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => console.log(name, "goto", e.message.slice(0, 80)));
  await p.waitForTimeout(1500);
  const errs = await p.locator("text=/could not be loaded|Something went wrong|Application error/i").count();
  console.log(name, p.url().replace("https://donordesk.online", ""), errs ? "ERROR-TEXT" : "ok");
  await p.screenshot({ path: `${out}/t-${name}.png` });
}
await b.close();
