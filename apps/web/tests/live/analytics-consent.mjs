// Live check of the public-site analytics consent, run against a real site in a fresh, signed-out browser:
//   DD_SITE=https://donordesk.online node apps/web/tests/live/analytics-consent.mjs
// It fails when anything is sent to Google before a yes, when a private page is tracked, or when a no does not stop tracking.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const SITE = (process.env.DD_SITE ?? "https://donordesk.online").replace(/\/$/, "");
const isGoogle = (url) => /googletagmanager\.com|google-analytics\.com/.test(url);
const browser = await chromium.launch();
let failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message.split("\n")[0]}`); }
};
const fresh = async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const seen = [];
  page.on("request", (r) => { if (isGoogle(r.url())) seen.push(r.url()); });
  return { context, page, seen };
};
const banner = (page) => page.getByRole("dialog", { name: "Cookie preferences" });

await check("before any answer: the question is asked and nothing goes to Google", async () => {
  const { context, page, seen } = await fresh();
  await page.goto(`${SITE}/pricing`);
  await banner(page).waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);
  assert.deepEqual(seen, []);
  assert.equal(await page.getByRole("button", { name: "Accept" }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Decline" }).count(), 1);
  await context.close();
});

await check("Decline: nothing goes to Google, no analytics cookie, and the question is not asked again", async () => {
  const { context, page, seen } = await fresh();
  await page.goto(`${SITE}/pricing`);
  await banner(page).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Decline" }).click();
  await page.goto(`${SITE}/features`);
  await page.waitForTimeout(2500);
  assert.deepEqual(seen, []);
  assert.equal((await context.cookies()).filter((c) => c.name.startsWith("_ga")).length, 0);
  assert.equal(await banner(page).count(), 0);
  assert.equal((await context.cookies()).find((c) => c.name === "dd_cookie_consent")?.value, "essential");
  await context.close();
});

await check("Accept: exactly one page view reaches Google for the page, with the path", async () => {
  const { context, page, seen } = await fresh();
  const hits = [];
  page.on("request", (r) => { if (/google-analytics\.com\/g\/collect/.test(r.url())) hits.push(new URL(r.url()).searchParams); });
  await page.goto(`${SITE}/pricing`);
  await banner(page).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Accept" }).click();
  await page.waitForTimeout(7000);
  const views = hits.filter((h) => h.get("en") === "page_view");
  assert.equal(views.length, 1, `page views: ${views.length}`);
  assert.equal(views[0].get("dl"), `${SITE}/pricing`);
  assert.ok(seen.some((u) => u.includes("id=G-")));
  await context.close();
});

await check("a private page is never tracked, even after Accept", async () => {
  const { context, page, seen } = await fresh();
  await page.goto(`${SITE}/features`);
  await banner(page).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Accept" }).click();
  await page.waitForTimeout(2000);
  const before = seen.length;
  await page.goto(`${SITE}/login`);
  await page.goto(`${SITE}/forgot-password`);
  await page.waitForTimeout(3000);
  assert.equal(seen.slice(before).filter((u) => /g\/collect/.test(u)).length, 0, "no hit from a private page");
  // in-app navigation from an allowed page to a private one must not be tracked either
  await page.goto(`${SITE}/features`);
  await page.waitForTimeout(3000);
  const mark = seen.length;
  await page.getByRole("link", { name: /log in/i }).first().click();
  await page.waitForURL(/\/login/, { timeout: 15000 });
  await page.waitForTimeout(4000);
  assert.equal(seen.slice(mark).filter((u) => /g\/collect/.test(u)).length, 0, "no hit after in-app navigation to a private page");
  assert.equal(await banner(page).count(), 0, "no question on a private page");
  await context.close();
});

await check("Cookie settings reopens the question and Decline then removes the analytics cookies", async () => {
  const { context, page } = await fresh();
  await page.goto(`${SITE}/features`);
  await banner(page).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Accept" }).click();
  await page.waitForFunction(() => document.cookie.includes("_ga"), null, { timeout: 20000 });
  await page.getByRole("button", { name: "Cookie settings" }).first().click();
  await banner(page).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Decline" }).click();
  await page.waitForTimeout(1500);
  assert.equal((await context.cookies()).filter((c) => c.name.startsWith("_ga")).length, 0);
  assert.equal((await context.cookies()).find((c) => c.name === "dd_cookie_consent")?.value, "essential");
  await context.close();
});

await check("the sign-up relay forwards at once without consent and never takes a free-text destination", async () => {
  const { context, page, seen } = await fresh();
  await page.goto(`${SITE}/welcome?kind=signup&to=https%3A%2F%2Fevil.example&plan=starter`, { waitUntil: "commit" });
  await page.waitForURL(/\/(onboarding|login)/, { timeout: 15000 });
  assert.ok(new URL(page.url()).host === new URL(SITE).host);
  assert.deepEqual(seen, []);
  await context.close();
});

await browser.close();
console.log(failed === 0 ? "\nall checks passed" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
