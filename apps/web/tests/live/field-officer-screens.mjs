/**
 * Live check of what a field officer can open (Phase 63b). Signs in (or reuses the open window) and visits every screen: the ones that are
 * their work must open, every other one must answer "not found". Exits 1 when a restricted screen opens or a work screen does not.
 *
 *   DD_PROJECT=<project id> [DD_EMAIL=… DD_PASS=…] [DD_CDP=http://127.0.0.1:9334] [DD_BASE=https://donordesk.online] node tests/live/field-officer-screens.mjs
 *
 * Credentials come from the environment only. With DD_CDP it attaches to an open Chromium (and signs in only when DD_EMAIL is set); without
 * it, it opens its own browser window.
 */
import { createRequire } from "node:module";
const require = createRequire(new URL("../../package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const BASE = process.env.DD_BASE ?? "https://donordesk.online";
const PROJECT = process.env.DD_PROJECT;
if (!PROJECT) { console.error("Set DD_PROJECT to a project the field officer is on."); process.exit(2); }
const P = `/projects/${PROJECT}`;

/** Opens for a field officer. */
const OPEN = ["/dashboard", "/inbox", "/projects", "/more", "/waiting", "/field", "/settings/security", P + "/activities", P + "/forms"];
/** Must answer "not found". */
const CLOSED = [
  "/visuals", "/visuals/charts/" + PROJECT, "/reports", "/compliance", "/downloads", "/where-we-work", "/programmes", "/portfolio", "/settings", "/settings/billing", "/team", "/audit", "/evidence", "/projects/new",
  P + "/finance", P + "/settings", P + "/team", P + "/data", P + "/enter", P + "/reports", P + "/ask", P + "/adaptations", P + "/management-report", P + "/charts", P + "/maps", P + "/import", P + "/setup", P + "/compliance",
  P + "/templates", P + "/report-builder", P + "/infographics", P + "/logframe", P + "/places", P + "/datasets", P + "/evidence", P + "/beneficiaries",
];
/** Words that must never reach a field officer's screen. */
const LEAKS = /lacks permission|results\.view|finance\.view|FIELD_OFFICER/;

const browser = process.env.DD_CDP ? await chromium.connectOverCDP(process.env.DD_CDP, { timeout: 20000 }) : await chromium.launch({ headless: false });
const context = browser.contexts()[0] ?? (await browser.newContext());
const page = context.pages()[0] ?? (await context.newPage());
page.setDefaultTimeout(15000);

if (process.env.DD_EMAIL) {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(process.env.DD_EMAIL);
  await page.getByLabel(/password/i).first().fill(process.env.DD_PASS ?? "");
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForTimeout(5000);
}

async function look(path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const text = (await page.innerText("body")).replace(/\s+/g, " ");
  return { text, final: page.url().replace(BASE, ""), notFound: /Page not found/.test(text) };
}

const failures = [];
for (const path of OPEN) {
  const r = await look(path);
  const ok = !r.notFound && !LEAKS.test(r.text);
  console.log(`${ok ? "ok  " : "FAIL"} opens   ${path}${r.final !== path ? `  -> ${r.final}` : ""}`);
  if (!ok) failures.push(`should open: ${path}${LEAKS.test(r.text) ? " (shows a permission word)" : ""}`);
}
for (const path of CLOSED) {
  const r = await look(path);
  const ok = r.notFound && !LEAKS.test(r.text);
  console.log(`${ok ? "ok  " : "FAIL"} closed  ${path}${r.final !== path ? `  -> ${r.final}` : ""}`);
  if (!ok) failures.push(`should be closed: ${path} (ended at ${r.final})`);
}
// The project's front page sends them to their work, not to an error or the Overview.
const front = await look(P);
const landed = /\/(forms|activities)$/.test(front.final);
console.log(`${landed ? "ok  " : "FAIL"} landing ${P} -> ${front.final}`);
if (!landed) failures.push("the project front page did not land on forms or activities");

console.log(failures.length ? `\n${failures.length} problem(s):\n- ${failures.join("\n- ")}` : "\nAll screens as expected.");
process.exit(failures.length ? 1 : 0);
