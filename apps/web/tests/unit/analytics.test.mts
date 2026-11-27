import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { allowsAnalytics, consentCookie, CONSENT_COOKIE, CONSENT_DAYS, parseConsent } from "../../src/features/analytics/domain/consent.ts";
import { ANALYTICS_ROUTES, asksConsentOn, isAnalyticsRoute, pagePathOf } from "../../src/features/analytics/domain/analytics-routes.ts";
import { ANALYTICS_EVENTS, resolveWelcome, welcomeAddress } from "../../src/features/analytics/domain/events.ts";
import { guardHistory } from "../../src/features/analytics/domain/history-guard.ts";
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

test("only the pages that ask for consent show the banner; the relay is allowed to send its event but asks nothing", () => {
  assert.equal(asksConsentOn("/pricing"), true);
  assert.equal(asksConsentOn("/welcome"), false);
  assert.equal(isAnalyticsRoute("/welcome"), true);
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
  const win: any = { location: { hostname: "donordesk.online" } };
  const doc: any = {
    cookie, title: "Pricing",
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

test("pause switches collection off without touching cookies, and start switches it back on", () => {
  const { win, doc } = fakeBrowser("_ga=1");
  const written: string[] = [];
  Object.defineProperty(doc, "cookie", { get: () => "_ga=1", set: (v: string) => written.push(v) });
  const tag = new GoogleTagAdapter("G-TEST", win, doc);
  tag.start();
  assert.equal(win["ga-disable-G-TEST"], false);
  tag.pause();
  assert.equal(win["ga-disable-G-TEST"], true);
  assert.deepEqual(written, []);
  tag.start();
  assert.equal(win["ga-disable-G-TEST"], false);
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

test("the consent manager stops on no, starts on an allowed page after yes, and pauses on any other page", () => {
  const source = readFileSync(new URL("../../src/features/analytics/presentation/ConsentManager.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!allowsAnalytics\(choice\)\) service\.stop\(\);\s*else if \(tracked\) service\.start\(\);\s*else service\.pause\(\);/);
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

test("the history guard decides on the path before the address changes, and can be undone", () => {
  const calls: string[] = [];
  const history: any = { pushState: (_d: unknown, _u: string, url?: string) => calls.push(`push ${url}`), replaceState: (_d: unknown, _u: string, url?: string) => calls.push(`replace ${url}`) };
  const original = history.pushState;
  const decided: string[] = [];
  const undo = guardHistory(history, "https://donordesk.online/pricing", (p) => decided.push(p));
  history.pushState(null, "", "/login?x=1");
  history.replaceState(null, "", "https://donordesk.online/features#a");
  history.replaceState(null, "", null);
  history.pushState(null, "", "http://[bad");
  assert.deepEqual(decided, ["/login", "/features"]);
  assert.deepEqual(calls, ["push /login?x=1", "replace https://donordesk.online/features#a", "replace null", "push http://[bad"]);
  undo();
  assert.equal(history.pushState, original);
});
