// A real-browser check of the field app on a phone-sized touch screen (the real Today, My week, Waiting, Me and form screens; only the
// server actions and the outbox are stubbed). It asserts what a person sees first and saves a picture of each screen to ./shots.
//   pnpm --filter @donordesk/web test:field-app
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../..");
const shots = join(here, "shots");
mkdirSync(shots, { recursive: true });
const out = mkdtempSync(join(tmpdir(), "field-app-"));
await build(join(out, "bundle.js"));
execFileSync("npx", ["tailwindcss", "-c", "tailwind.config.ts", "-i", "src/app/globals.css", "-o", join(out, "styles.css")], { cwd: web, stdio: "ignore" });
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>';
const files = { "/": ["text/html", html], "/styles.css": ["text/css", readFileSync(join(out, "styles.css"))], "/bundle.js": ["text/javascript", readFileSync(join(out, "bundle.js"))] };
const server = createServer((req, res) => { const f = files[(req.url ?? "/").split("?")[0]] ?? ["text/plain", "not found"]; res.setHeader("content-type", f[0]); res.end(f[1]); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const errors = [];
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(`ok   ${name}`); } catch (e) { results.push(`FAIL ${name} :: ${String(e.message).split("\n").slice(0, 8).join(" ")}`); } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function open(hash = "", ctx = PHONE) {
  const context = await browser.newContext(ctx);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  await page.goto(base + (hash ? `#${hash}` : ""));
  await page.getByTestId("host").waitFor();
  await page.waitForTimeout(600);
  return page;
}
const snap = (page, name) => page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
const noSideScroll = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "the page scrolls sideways");
const smallTargets = (page) => page.evaluate(() => [...document.querySelectorAll("button, a[href], select, input:not([type=hidden])")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40; }).map((e) => `${e.tagName}:${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)}:${Math.round(e.getBoundingClientRect().height)}`));

await check("first time: one card and one button, no tabs, nothing to choose", async () => {
  const page = await open("none=1");
  await page.getByRole("heading", { name: /Good (morning|afternoon|evening)|Hello/ }).waitFor();
  assert.ok(await page.getByText("Get your work ready").isVisible());
  assert.deepEqual(await page.getByRole("button", { name: "Get my jobs" }).count(), 1);
  assert.equal(await page.getByRole("navigation").count(), 0, "no tab bar before there is work");
  await noSideScroll(page); await snap(page, "01-first-time");
  await page.getByRole("button", { name: "Get my jobs" }).click();
  await page.getByRole("heading", { name: "Do this next" }).or(page.getByText("Do this next")).first().waitFor();
});

await check("today: a greeting with the first name, the one thing to do next, the visits, the work and the tabs", async () => {
  const page = await open("");
  const greeting = await page.getByRole("heading", { level: 1 }).innerText();
  assert.match(greeting, /(Good (morning|afternoon|evening)|Hello), Amina$/);
  assert.ok(await page.getByText("All your work is sent").isVisible());
  assert.ok(await page.getByText("Online").first().isVisible());
  const next = page.getByRole("region", { name: "Do this next" });
  assert.match(await next.innerText(), /Cat-B Hospital Chakdara/);
  assert.ok(await next.getByRole("button", { name: "Start visit" }).isVisible());
  assert.ok(await page.getByRole("heading", { name: "Visits given to you" }).isVisible());
  assert.ok(await page.getByRole("heading", { name: "Your planned work" }).isVisible());
  assert.equal(await page.getByRole("navigation").getByRole("button").count(), 4);
  assert.deepEqual((await page.getByRole("navigation").getByRole("button").allInnerTexts()).map((t) => t.split("\n")[0]), ["Today", "My week", "Waiting", "Me"]);
  await noSideScroll(page);
  assert.deepEqual(await smallTargets(page), [], "every control is thumb-sized");
  await snap(page, "02-today");
});

await check("a started visit comes first and says Continue; a late one says when it was due", async () => {
  const started = await open("started=1");
  assert.ok(await started.getByRole("region", { name: "Do this next" }).getByRole("button", { name: "Continue visit" }).isVisible());
  const late = await open("late=1");
  assert.match(await late.getByRole("region", { name: "Do this next" }).innerText(), /Late: was due/);
  await snap(late, "03-late");
});

await check("with no signal it says so, calmly, and says the work is kept", async () => {
  const page = await open("offline=1&waiting=1");
  assert.ok(await page.getByText("No signal").first().isVisible());
  assert.ok(await page.getByText("Your work is kept on this phone and is sent when the signal is back.").isVisible());
  assert.ok(await page.getByText("Waiting to send: 1").isVisible());
  assert.ok(await page.getByText("Needs your help: 1").first().isVisible());
  assert.equal(await page.getByRole("button", { name: "Send now" }).count(), 0, "nothing to press with no signal");
  await snap(page, "04-offline-waiting");
});

await check("start a visit: the form opens at that facility with a way back", async () => {
  const page = await open("");
  await page.getByRole("region", { name: "Do this next" }).getByRole("button", { name: "Start visit" }).click();
  await page.getByRole("button", { name: "← Today" }).waitFor();
  assert.ok(await page.getByRole("heading", { name: "Health facility assessment" }).isVisible());
  await page.getByText("Name of the person in charge").first().waitFor();
  assert.equal(await page.getByRole("navigation").count(), 0, "the tabs step aside while filling");
  await snap(page, "05-form");
  await page.getByRole("button", { name: "← Today" }).click();
  await page.getByRole("heading", { name: /Good|Hello/ }).waitFor();
});

await check("my week: what is late, then the days that have something", async () => {
  const page = await open("late=1");
  await page.getByRole("navigation").getByRole("button", { name: "My week" }).click();
  await page.getByRole("heading", { name: "My week" }).waitFor();
  assert.ok(await page.getByRole("heading", { name: "Late" }).isVisible());
  await snap(page, "06-week");
});

await check("waiting: what is saved on the phone, in plain words", async () => {
  const page = await open("waiting=1");
  await page.getByRole("navigation").getByRole("button", { name: /Waiting/ }).click();
  await page.getByRole("heading", { name: "Waiting to send" }).first().waitFor();
  assert.ok(await page.getByText("These are saved on this phone. They are sent by themselves when you have signal.").isVisible());
  await snap(page, "07-waiting");
  const empty = await open("");
  await empty.getByRole("navigation").getByRole("button", { name: "Waiting" }).click();
  assert.ok(await empty.getByText(/Everything is sent. Nothing is waiting./).isVisible());
});

await check("me: the projects on the phone, refresh, language, the online home page and sign out with a warning", async () => {
  const page = await open("");
  await page.getByRole("navigation").getByRole("button", { name: "Me" }).click();
  await page.getByRole("heading", { name: "Amina" }).waitFor();
  assert.ok(await page.getByText("Borno health facility assessment").isVisible());
  assert.ok(await page.getByRole("button", { name: "Refresh my jobs" }).isEnabled());
  assert.equal(await page.getByRole("link", { name: "Open the online home page" }).getAttribute("href"), "/dashboard?stay=1");
  assert.equal(await page.getByRole("link", { name: "Sign out" }).getAttribute("href"), "/logout");
  assert.ok(await page.getByText(/Signing out removes your downloaded work/).isVisible());
  await noSideScroll(page); await snap(page, "08-me");
});

await check("old work is refreshed quietly when there is signal", async () => {
  const page = await open("old=1");
  await page.waitForTimeout(800);
  const calls = await page.evaluate(() => window.__h.calls.map((c) => c[0]));
  assert.ok(calls.includes("downloadOfflinePackAction"), "refreshed by itself");
});

await check("Arabic: right to left, the greeting and the tabs in Arabic", async () => {
  const page = await open("lang=ar");
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  assert.match(await page.getByRole("heading", { level: 1 }).innerText(), /Amina/);
  assert.deepEqual((await page.getByRole("navigation").getByRole("button").allInnerTexts()).map((t) => t.split("\n")[0]), ["اليوم", "أسبوعي", "بالانتظار", "أنا"]);
  await noSideScroll(page); await snap(page, "09-arabic");
});

await check("French: the greeting and the one big button", async () => {
  const page = await open("lang=fr");
  assert.match(await page.getByRole("heading", { level: 1 }).innerText(), /(Bonjour|Bon après-midi|Bonsoir), Amina/);
  assert.ok(await page.getByRole("button", { name: "Commencer la visite" }).first().isVisible());
});

await check("a person with nothing given yet sees a calm all-caught-up card", async () => {
  const page = await open("empty=1");
  assert.ok(await page.getByText("You are all caught up").isVisible());
  await snap(page, "10-caught-up");
});

await browser.close(); server.close();
console.log(results.join("\n"));
const realErrors = errors.filter((e) => !/Failed to load resource|favicon|manifest/i.test(e));
if (realErrors.length) console.log(`\nbrowser errors:\n${[...new Set(realErrors)].join("\n")}`);
process.exit(results.some((r) => r.startsWith("FAIL")) || realErrors.length ? 1 : 0);
