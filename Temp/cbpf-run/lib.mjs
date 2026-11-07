// Shared runner: attaches to the open visible Chromium (CDP 9333), logs every console error / failed request / failed step to issues.jsonl
import { createRequire } from "node:module";
import { appendFileSync, mkdirSync } from "node:fs";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const dir = new URL(".", import.meta.url).pathname;
mkdirSync(dir + "shots", { recursive: true });
export const BASE = "https://donordesk.online";
let n = 0;
export const issue = (phase, kind, msg, url = "") => { const r = { t: new Date().toISOString(), phase, kind, msg: String(msg).slice(0, 600), url }; appendFileSync(dir + "issues.jsonl", JSON.stringify(r) + "\n"); console.log("ISSUE", kind, "-", r.msg); };
export async function attach(phase) {
  const browser = await chromium.connectOverCDP("http://localhost:9333");
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.setDefaultTimeout(20000);
  if (!page.__hooked) {
    page.__hooked = true;
    page.on("pageerror", (e) => issue(phase, "pageerror", e, page.url()));
    page.on("console", (m) => { if (m.type() === "error") issue(phase, "console", m.text(), page.url()); });
    page.on("response", (r) => { if (r.status() >= 400 && !/\/_next\/|favicon/.test(r.url())) issue(phase, "http" + r.status(), `${r.request().method()} ${r.url()}`, page.url()); });
  }
  const shot = async (name) => page.screenshot({ path: `${dir}shots/${Date.now()%1000000}-${String(++n).padStart(3, "0")}-${name}.png` }).catch(() => {});
  const step = async (name, fn) => { console.log("STEP", name); try { await fn(); await page.waitForTimeout(400); await shot(name.replace(/\W+/g, "-").slice(0, 40)); } catch (e) { issue(phase, "step-failed", `${name}: ${String(e.message).split("\n")[0]}`, page.url()); await shot("FAIL-" + name.replace(/\W+/g, "-").slice(0, 30)); } };
  const type = async (label, value, scope = page) => { const b = scope.getByLabel(label, { exact: true }).first(); await b.fill(value); await b.press("Tab"); await page.waitForTimeout(150); };
  const text = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
  return { browser, page, shot, step, type, text };
}
