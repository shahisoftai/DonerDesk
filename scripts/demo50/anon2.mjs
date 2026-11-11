import { chromium } from "../demo-ui/lib.mjs";
const browser = await chromium.connectOverCDP("http://localhost:9360");
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const f = window.fetch;
  window.fetch = function (input, init) {
    const method = (init && init.method) || (input && input.method) || "GET";
    const url = typeof input === "string" ? input : input.url;
    if (method === "POST") console.log("POSTSTACK " + url + " :: " + (init && init.headers && (init.headers["Next-Action"] || init.headers["next-action"])) + " :: " + new Error().stack.split("\n").slice(2, 9).join(" | ").replace(/https:\/\/donordesk.online/g, ""));
    return f.apply(this, arguments);
  };
});
const page = await ctx.newPage();
page.on("console", (m) => { if (m.text().startsWith("POSTSTACK")) console.log(m.text().slice(0, 1500)); });
await page.goto(process.argv[2], { waitUntil: "domcontentloaded" });
await page.waitForTimeout(20000);
await ctx.close(); await browser.close(); process.exit(0);
