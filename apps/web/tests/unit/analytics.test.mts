import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { allowsAnalytics, consentCookie, CONSENT_COOKIE, CONSENT_DAYS, parseConsent } from "../../src/features/analytics/domain/consent.ts";
import { ANALYTICS_ROUTES, asksConsentOn, countsPageViewOn, isAnalyticsRoute, pagePathOf } from "../../src/features/analytics/domain/analytics-routes.ts";
import { ANALYTICS_EVENTS, resolveWelcome, welcomeAddress } from "../../src/features/analytics/domain/events.ts";
import { GoogleTagAdapter } from "../../src/features/analytics/adapters/google-tag-adapter.ts";

test("only an explicit yes allows analytics, and the old cookie values still read", () => {
  assert.equal(allowsAnalytics("all"), true);
  assert.equal(allowsAnalytics("essential"), false);
  assert.equal(allowsAnalytics(null), false);
  assert.equal(parseConsent(`a=1; ${CONSENT_COOKIE}=all; b=2`), "all");
  assert.equal(parseConsent(`${CONSENT_COOKIE}=essential`), "essential");
  for (const bad of ["", "x=1", `${CONSENT_COOKIE}=yes`, `${CONSENT_COOKIE}=`, `x${CONSENT_COOKIE}=all`]) assert.equal(parseConsent(bad), null, bad);
});

test("the choice cookie lasts six months and is Secure on https only", () => {
  assert.equal(CONSENT_DAYS, 180);
  const c = consentCookie("all", true);
  assert.ok(c.startsWith(`${CONSENT_COOKIE}=all;`) && c.includes(`Max-Age=${180 * 86400}`) && c.endsWith("; Secure") && c.includes("SameSite=Lax"));
  assert.ok(!consentCookie("essential", false).includes("Secure"));
});

test("public marketing and legal pages may be tracked, with or without a trailing slash or a query", () => {
  for (const ok of ["/", "/pricing", "/pricing/", "/pricing?plan=team#x", "/solutions", "/solutions/health", "/support/a/b", "/privacy", "/signup", "/tour", "/welcome"]) assert.ok(isAnalyticsRoute(ok), ok);
});

test("the signed-in app, share, embed, collect, invite, reset, field and checkout pages are never tracked", () => {
  const never = ["/dashboard", "/projects/123/evidence", "/settings/billing", "/inbox", "/visuals/x", "/shared/dashboard/tok", "/shared/canvas/tok", "/embed/canvas/tok",
    "/collect/tok", "/invite/tok", "/reset-password", "/forgot-password", "/login", "/logout", "/field", "/checkout", "/thanks", "/onboarding", "/api/x", "/scim/v2", "/maps",
    "/pricingx", "/solutionsx", "/supportive", "/privacy-x"];
  for (const path of never) assert.equal(isAnalyticsRoute(path), false, path);
});

test("every portal route directory is untracked: a new route is private by default", () => {
  const portal = join(import.meta.dirname, "../../src/app/(portal)");
  for (const name of readdirSync(portal).filter((n) => statSync(join(portal, n)).isDirectory())) assert.equal(isAnalyticsRoute(`/${name}`), false, name);
});

test("only the pages that ask for consent show the banner, and the relay sends an event but is not a page view", () => {
  assert.equal(asksConsentOn("/pricing"), true);
  assert.equal(asksConsentOn("/welcome"), false);
  assert.equal(countsPageViewOn("/welcome"), false);
  assert.equal(countsPageViewOn("/tour"), true);
  assert.equal(asksConsentOn("/dashboard"), false);
  assert.ok(ANALYTICS_ROUTES.length >= 18);
});

test("the path sent is the path only", () => {
  assert.equal(pagePathOf("/pricing?token=secret#top"), "/pricing");
  assert.equal(pagePathOf("/support/x/"), "/support/x");
  assert.equal(pagePathOf("/"), "/");
  assert.equal(pagePathOf(""), "/");
});

test("the sign-up relay only ever forwards to the app's own two pages and sends fixed words", () => {
  assert.deepEqual(resolveWelcome({}), { event: "sign_up", params: { method: "email", plan: "starter" }, next: "/onboarding" });
  assert.deepEqual(resolveWelcome({ kind: "signup", to: "checkout", plan: "team" }), { event: "sign_up", params: { method: "email", plan: "team" }, next: "/checkout?plan=team" });
  assert.deepEqual(resolveWelcome({ kind: "trial", to: "onboarding", plan: "growth" }), { event: "begin_trial", params: { plan: "growth" }, next: "/onboarding" });
  for (const evil of ["https://evil.example", "//evil.example", "/admin", "javascript:alert(1)", "../x"]) {
    const w = resolveWelcome({ to: evil, plan: evil, kind: evil });
    assert.equal(w.next, "/onboarding");
    assert.equal(w.params.plan, "starter");
  }
  assert.equal(resolveWelcome({ to: "checkout", plan: "starter" }).next, "/onboarding", "a free plan never goes to checkout");
  assert.equal(welcomeAddress("trial", "checkout", "team"), "/welcome?kind=trial&to=checkout&plan=team");
  assert.deepEqual(Object.values(ANALYTICS_EVENTS), ["sign_up", "begin_trial"]);
});

function fakeBrowser(cookie = "") {
  const pushed: unknown[][] = [];
  const appended: Array<{ src: string }> = [];
  const win: any = { location: { origin: "https://donordesk.online", hostname: "donordesk.online", pathname: "/pricing" } };
  const doc: any = {
    cookie, title: "Pricing", referrer: "https://donordesk.online/features?x=secret",
    createElement: () => ({ async: false, src: "" }),
    head: { appendChild: (n: { src: string }) => appended.push(n) },
    querySelector: () => (appended.length ? {} : null),
  };
  win.dataLayer = pushed;
  return { win, doc, pushed, appended };
}

test("nothing is loaded until start, and start sets no advertising features", () => {
  const { win, doc, pushed, appended } = fakeBrowser();
  const tag = new GoogleTagAdapter("G-TEST", win, doc);
  tag.pageView("/pricing");
  assert.equal(appended.length, 0);
  assert.equal(pushed.length, 0);
  tag.start();
  tag.start();
  assert.equal(appended.length, 1, "the script is added once");
  assert.ok(appended[0].src.startsWith("https://www.googletagmanager.com/gtag/js?id=G-TEST"));
  const flat = JSON.stringify(pushed.map((a) => Array.from(a as unknown[])));
  assert.ok(flat.includes('"ad_storage":"denied"') && flat.includes('"allow_google_signals":false') && flat.includes('"send_page_view":false'));
});

test("the queue holds `arguments` objects, which is the only form gtag.js reads", () => {
  const { win, doc, pushed } = fakeBrowser();
  new GoogleTagAdapter("G-TEST", win, doc).start();
  assert.ok(pushed.length >= 3);
  for (const entry of pushed) {
    assert.equal(Array.isArray(entry), false);
    assert.equal(Object.prototype.toString.call(entry), "[object Arguments]");
  }
});

test("the page address is set clean, so the query never reaches Google, for the page view and for Google's own events", () => {
  const { win, doc, pushed } = fakeBrowser();
  const tag = new GoogleTagAdapter("G-TEST", win, doc);
  tag.start();
  const config = Array.from(pushed.find((e) => (e as unknown[])[0] === "config") as unknown[]);
  assert.equal((config[2] as Record<string, string>).page_location, "https://donordesk.online/pricing");
  tag.pageView("/pricing");
  const calls = pushed.map((e) => Array.from(e as unknown[]));
  const set = calls.filter((c) => c[0] === "set").at(-1)![1] as Record<string, string>;
  assert.deepEqual([set.page_path, set.page_location, set.page_referrer], ["/pricing", "https://donordesk.online/pricing", "https://donordesk.online/features"]);
  assert.deepEqual(calls.at(-1), ["event", "page_view"]);
  assert.ok(!JSON.stringify(calls).includes("secret"));
});

test("stop disables collection and removes the analytics cookies but not the others", () => {
  const { win, doc } = fakeBrowser("_ga=1; _ga_ABC=2; _gid=3; dd_cookie_consent=all; theme=dark");
  const written: string[] = [];
  Object.defineProperty(doc, "cookie", { get: () => "_ga=1; _ga_ABC=2; _gid=3; dd_cookie_consent=all", set: (v: string) => written.push(v) });
  new GoogleTagAdapter("G-TEST", win, doc).stop();
  assert.equal(win["ga-disable-G-TEST"], true);
  assert.ok(written.some((w) => w.startsWith("_ga=; Max-Age=0")));
  assert.ok(written.some((w) => w.startsWith("_ga_ABC=; Max-Age=0")));
  assert.ok(written.some((w) => w.startsWith("_gid=; Max-Age=0")));
  assert.ok(!written.some((w) => w.startsWith("dd_cookie_consent")));
});

test("an event resolves once Google calls back, and at once when analytics never started", async () => {
  const { win, doc, pushed } = fakeBrowser();
  const tag = new GoogleTagAdapter("G-TEST", win, doc);
  await tag.event("sign_up");
  assert.equal(pushed.length, 0);
  tag.start();
  const done = tag.event("sign_up", { method: "email" });
  const call = Array.from(pushed.at(-1) as unknown[]);
  assert.deepEqual(call.slice(0, 2), ["event", "sign_up"]);
  (call[2] as { event_callback: () => void }).event_callback();
  await done;
});

test("an event that Google never confirms (an ad blocker) still lets the page move on", async () => {
  const { win, doc } = fakeBrowser();
  const tag = new GoogleTagAdapter("G-TEST", win, doc);
  tag.start();
  const t0 = Date.now();
  await tag.event("sign_up");
  assert.ok(Date.now() - t0 < 2000);
});

test("the old per-page banner is gone and the root layout hosts the one consent manager", () => {
  const layout = readFileSync(new URL("../../src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /<ConsentManager \/>/);
  const dir = join(import.meta.dirname, "../../src/app");
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : []; });
  for (const file of walk(dir)) assert.ok(!readFileSync(file, "utf8").includes("CookieConsentBanner"), file);
});

test("the cookie banner gives yes and no the same look", () => {
  const banner = readFileSync(new URL("../../src/features/analytics/presentation/CookieBanner.tsx", import.meta.url), "utf8");
  const uses = banner.match(/className=\{BUTTON\}/g) ?? [];
  assert.equal(uses.length, 2);
});

test("every page that asks for the cookie answer links to the policy, and both footers can reopen it", () => {
  for (const f of ["../../src/components/landing/MarketingFooter.tsx", "../../src/components/legal/LegalLayout.tsx", "../../src/components/site/SiteFooter.tsx", "../../src/components/support/WikiLayout.tsx", "../../src/components/support/CategoryArticle.tsx", "../../src/app/pricing/page.tsx", "../../src/app/support/page.tsx"]) {
    assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /CookieSettingsLink/);
  }
});
