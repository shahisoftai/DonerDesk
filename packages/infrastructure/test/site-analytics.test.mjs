import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { StatsSourceNotConfigured } from "@donordesk/application";
import { createWebsiteStatsHandler } from "../dist/index.js";
import { GoogleAnalyticsTrafficSource, GoogleTokenProvider, SearchConsoleSource, TtlCache, parseServiceAccountKey } from "../dist/site-analytics/index.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KEY_JSON = JSON.stringify({
  type: "service_account",
  client_email: "reader@example.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  token_uri: "https://oauth2.googleapis.com/token",
});
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const WINDOW = { startDate: "2026-11-21", endDate: "2026-11-27" };
const PREV = { startDate: "2026-11-14", endDate: "2026-11-20" };

test("a key file is checked and its refusal never repeats the file", () => {
  assert.equal(parseServiceAccountKey(KEY_JSON).clientEmail, "reader@example.iam.gserviceaccount.com");
  for (const bad of ["not json", JSON.stringify({ type: "authorized_user" }), JSON.stringify({ type: "service_account", client_email: "a", private_key: "x" })]) {
    assert.throws(() => parseServiceAccountKey(bad), (e) => e instanceof StatsSourceNotConfigured && !e.message.includes("authorized_user"));
  }
});

test("the token request is a correctly signed assertion and the token is reused until it nears its end", async () => {
  let calls = 0;
  let assertion = "";
  let now = 1_000;
  const fetcher = async (_url, init) => { calls++; assertion = init.body.get("assertion"); return json({ access_token: `tok${calls}`, expires_in: 3600 }); };
  const tokens = new GoogleTokenProvider(async () => parseServiceAccountKey(KEY_JSON), fetcher, () => now);
  assert.equal(await tokens.token(["b", "a"]), "tok1");
  const [head, claim, sig] = assertion.split(".");
  assert.ok(createVerify("RSA-SHA256").update(`${head}.${claim}`).verify(publicKey, sig, "base64url"));
  const payload = JSON.parse(Buffer.from(claim, "base64url"));
  assert.deepEqual([payload.iss, payload.scope, payload.iat, payload.exp], ["reader@example.iam.gserviceaccount.com", "a b", 1000, 4600]);
  now = 4000;
  assert.equal(await tokens.token(["a", "b"]), "tok1", "same scopes in another order share a token");
  now = 4500;
  assert.equal(await tokens.token(["a", "b"]), "tok2", "renewed shortly before it expires");
});

test("Google refusing the key is a plain sentence, not Google's body", async () => {
  const tokens = new GoogleTokenProvider(async () => parseServiceAccountKey(KEY_JSON), async () => json({ error: "invalid_grant", detail: "SECRET" }, 400));
  await assert.rejects(tokens.token(["x"]), (e) => e.name === "StatsSourceUnavailable" && !e.message.includes("SECRET"));
});

const GA_FIRST = {
  reports: [
    { dimensionHeaders: [{ name: "dateRange" }], metricHeaders: [{ name: "activeUsers" }, { name: "screenPageViews" }, { name: "sessions" }], rows: [
      { dimensionValues: [{ value: "date_range_0" }], metricValues: [{ value: "100" }, { value: "340" }, { value: "150" }] },
      { dimensionValues: [{ value: "date_range_1" }], metricValues: [{ value: "80" }, { value: "300" }, { value: "120" }] } ] },
    { dimensionHeaders: [{ name: "date" }], metricHeaders: [{ name: "activeUsers" }, { name: "screenPageViews" }], rows: [
      { dimensionValues: [{ value: "20261122" }], metricValues: [{ value: "10" }, { value: "30" }] } ] },
    { dimensionHeaders: [{ name: "pagePath" }], metricHeaders: [{ name: "screenPageViews" }, { name: "activeUsers" }], rows: [
      { dimensionValues: [{ value: "/pricing" }], metricValues: [{ value: "50" }, { value: "40" }] },
      { dimensionValues: [{ value: "/" }], metricValues: [{ value: "90" }, { value: "70" }] } ] },
    { dimensionHeaders: [{ name: "sessionSource" }], metricHeaders: [{ name: "activeUsers" }], rows: [
      { dimensionValues: [{ value: "(direct)" }], metricValues: [{ value: "30" }] },
      { dimensionValues: [{ value: "google" }], metricValues: [{ value: "60" }] } ] },
  ],
};
const GA_SECOND = {
  reports: [
    { dimensionHeaders: [{ name: "country" }], metricHeaders: [{ name: "activeUsers" }], rows: [{ dimensionValues: [{ value: "Kenya" }], metricValues: [{ value: "20" }] }, { dimensionValues: [{ value: "(not set)" }], metricValues: [{ value: "5" }] }] },
    { dimensionHeaders: [{ name: "deviceCategory" }], metricHeaders: [{ name: "activeUsers" }], rows: [{ dimensionValues: [{ value: "desktop" }], metricValues: [{ value: "70" }] }] },
    { dimensionHeaders: [{ name: "eventName" }, { name: "dateRange" }], metricHeaders: [{ name: "eventCount" }], rows: [
      { dimensionValues: [{ value: "sign_up" }, { value: "date_range_0" }], metricValues: [{ value: "5" }] } ] },
  ],
};

test("Analytics: totals, change, days without visits, names and sign-ups are read by header", async () => {
  const bodies = [];
  const google = { post: async (url, body) => (bodies.push([url, body]), bodies.length === 1 ? GA_FIRST : GA_SECOND) };
  const report = await new GoogleAnalyticsTrafficSource(google, "566025500").read(WINDOW, PREV);
  assert.ok(bodies[0][0].includes("properties/566025500:batchRunReports"));
  assert.deepEqual(report.visitors, { value: 100, previous: 80, change: 0.25 });
  assert.equal(report.pageViews.value, 340);
  assert.equal(report.daily.length, 7);
  assert.deepEqual(report.daily.find((d) => d.date === "2026-11-22"), { date: "2026-11-22", visitors: 10, pageViews: 30 });
  assert.deepEqual(report.daily.find((d) => d.date === "2026-11-23"), { date: "2026-11-23", visitors: 0, pageViews: 0 });
  assert.deepEqual(report.pages.map((p) => p.path), ["/", "/pricing"]);
  assert.deepEqual(report.sources.map((s) => s.name), ["google", "Direct"]);
  assert.deepEqual(report.countries.map((s) => s.name), ["Kenya", "Not known"]);
  assert.equal(report.signUps.value, 5);
  assert.equal(report.signUps.change, null, "no earlier sign-ups, so no percentage");
  assert.equal(report.trialStarts.value, 0);
  assert.equal(report.signUpRate, 0.05);
});

test("Analytics without a property says so", async () => {
  await assert.rejects(new GoogleAnalyticsTrafficSource({ post: async () => ({}) }, undefined).read(WINDOW, PREV), StatsSourceNotConfigured);
  await assert.rejects(new GoogleAnalyticsTrafficSource({ post: async () => ({}) }, "abc").read(WINDOW, PREV), StatsSourceNotConfigured);
});

test("Search Console: totals, rate, paths, and no rate without impressions", async () => {
  const answer = (body) => {
    const dims = body.dimensions.join(",");
    if (dims === "") return { rows: [{ clicks: body.startDate === "2026-11-14" ? 5 : 10, impressions: body.startDate === "2026-11-14" ? 100 : 200, position: 7.5 }] };
    if (dims === "date") return { rows: [{ keys: ["2026-11-23"], clicks: 4, impressions: 90 }, { keys: ["2026-11-22"], clicks: 6, impressions: 110 }] };
    if (dims === "query") return { rows: [{ keys: ["donor reporting"], clicks: 8, impressions: 120, position: 3.2 }, { keys: ["ngo software"], clicks: 0, impressions: 0, position: 12 }] };
    if (dims === "page") return { rows: [{ keys: ["https://donordesk.online/pricing"], clicks: 3, impressions: 30, position: 5 }] };
    if (dims === "country") return { rows: [{ keys: ["ken"], clicks: 2, impressions: 20, position: 4 }] };
    return { rows: [{ keys: ["MOBILE"], clicks: 1, impressions: 10, position: 6 }] };
  };
  const urls = [];
  const google = { post: async (url, body) => (urls.push(url), answer(body)) };
  const report = await new SearchConsoleSource(google, "sc-domain:donordesk.online").read({ startDate: "2026-11-19", endDate: "2026-11-25" }, { startDate: "2026-11-14", endDate: "2026-11-18" });
  assert.ok(urls[0].includes("sites/sc-domain%3Adonordesk.online/searchAnalytics/query"));
  assert.deepEqual(report.clicks, { value: 10, previous: 5, change: 1 });
  assert.equal(report.ctr, 0.05);
  assert.equal(report.position, 7.5);
  assert.deepEqual(report.daily.map((d) => d.date), ["2026-11-22", "2026-11-23"]);
  assert.deepEqual(report.queries.map((q) => [q.name, q.ctr, q.position]), [["donor reporting", 8 / 120, 3.2], ["ngo software", null, null]]);
  assert.equal(report.pages[0].name, "/pricing");
  assert.equal(report.countries[0].name, "KEN");
  assert.equal(report.devices[0].name, "Mobile");
});

test("Search Console with no data at all has no rate and no position, not zeros pretending to be measured", async () => {
  const report = await new SearchConsoleSource({ post: async () => ({}) }, "sc-domain:x").read(WINDOW, PREV);
  assert.deepEqual([report.clicks.value, report.ctr, report.position, report.queries], [0, null, null, []]);
  await assert.rejects(new SearchConsoleSource({ post: async () => ({}) }, undefined).read(WINDOW, PREV), StatsSourceNotConfigured);
});

test("the cache holds a value for its time and then forgets it", () => {
  let now = 0;
  const cache = new TtlCache(100, () => now);
  cache.set("k", 1);
  assert.equal(cache.get("k"), 1);
  now = 100;
  assert.equal(cache.get("k"), undefined);
});

test("the whole report with nothing configured says what is missing, and never throws", async () => {
  const report = await createWebsiteStatsHandler({}).handle("28");
  assert.equal(report.traffic.status, "NOT_CONFIGURED");
  assert.equal(report.search.status, "NOT_CONFIGURED");
});

test("the whole report end to end with a fake Google", async () => {
  const fetcher = async (url, init) => {
    if (String(url).includes("oauth2")) return json({ access_token: "t", expires_in: 3600 });
    assert.equal(init.headers.authorization, "Bearer t");
    if (String(url).includes("analyticsdata")) return json(JSON.parse(init.body).requests.length === 4 ? GA_FIRST : GA_SECOND);
    return json({ rows: [{ keys: ["x"], clicks: 1, impressions: 10, position: 2 }] });
  };
  const handler = createWebsiteStatsHandler(
    { GOOGLE_STATS_SERVICE_ACCOUNT_FILE: "/key.json", GA4_PROPERTY_ID: "566025500", SEARCH_CONSOLE_SITE: "sc-domain:donordesk.online" },
    { fetcher, read: async () => KEY_JSON },
  );
  const report = await handler.handle("28");
  assert.equal(report.traffic.status, "OK");
  assert.equal(report.search.status, "OK");
  assert.equal(report.traffic.data.visitors.value, 100);
});

test("an unreadable key file is a plain sentence", async () => {
  const handler = createWebsiteStatsHandler({ GOOGLE_STATS_SERVICE_ACCOUNT_FILE: "/nope", GA4_PROPERTY_ID: "1", SEARCH_CONSOLE_SITE: "x" }, { read: async () => { throw new Error("ENOENT /nope"); } });
  const report = await handler.handle("7");
  assert.equal(report.traffic.status, "NOT_CONFIGURED");
  assert.ok(!report.traffic.note.includes("ENOENT"));
});
