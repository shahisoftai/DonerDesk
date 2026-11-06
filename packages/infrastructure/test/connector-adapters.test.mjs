import test from "node:test";
import assert from "node:assert/strict";
import { EnvConnectorSecrets, SafeConnectorHttp } from "../dist/integrations/connector-adapters.js";
import { randomBytes } from "node:crypto";

const key = randomBytes(32).toString("base64");

test("a key is encrypted with a fresh nonce each time, read back exactly, and a changed value fails to read", () => {
  const box = new EnvConnectorSecrets(key);
  assert.equal(box.available, true);
  const a = box.encrypt("user@x.org:p@ss:word");
  const b = box.encrypt("user@x.org:p@ss:word");
  assert.notEqual(a, b);
  assert.ok(!a.includes("p@ss"));
  assert.equal(box.decrypt(a), "user@x.org:p@ss:word");
  const parts = a.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => box.decrypt(parts.join(":")));
  assert.throws(() => new EnvConnectorSecrets(randomBytes(32).toString("base64")).decrypt(a), "another key cannot read it");
});

test("with no key (or one of the wrong length) nothing can be kept", () => {
  assert.equal(new EnvConnectorSecrets(undefined).available, false);
  assert.equal(new EnvConnectorSecrets("c2hvcnQ=").available, false);
  assert.throws(() => new EnvConnectorSecrets(undefined).encrypt("x"));
});

const res = (status, body, headers = {}) => new Response(body, { status, headers });
const http = (reply, resolved = ["93.184.216.34"]) => {
  const seen = [];
  const h = new SafeConnectorHttp(async () => resolved, async (url, init) => (seen.push([url, init]), typeof reply === "function" ? reply() : reply));
  return { h, seen };
};

test("the other tool is called only at a public address, with no redirect followed, and answers are told apart", async () => {
  const good = http(res(200, JSON.stringify({ results: [] })));
  assert.deepEqual(await good.h.get("https://kf.kobotoolbox.org/api/v2/x", { authorization: "Token t" }), { ok: true, json: { results: [] } });
  assert.equal(good.seen[0][1].redirect, "manual");
  assert.equal(good.seen[0][1].headers.authorization, "Token t");

  assert.deepEqual(await http(res(200, "{}"), ["10.0.0.5"]).h.get("https://kf.example.org/x", {}), { ok: false, reason: "UNSAFE_ADDRESS" });
  assert.deepEqual(await http(res(200, "{}"), ["93.184.216.34", "169.254.169.254"]).h.get("https://kf.example.org/x", {}), { ok: false, reason: "UNSAFE_ADDRESS" }, "one private answer is enough to refuse");
  const refused = http(res(200, "{}"));
  assert.deepEqual(await refused.h.get("http://kf.example.org/x", {}), { ok: false, reason: "UNSAFE_ADDRESS" });
  assert.equal(refused.seen.length, 0, "nothing was sent");

  const reasons = async (r) => (await http(r).h.get("https://kf.example.org/x", {})).reason;
  assert.equal(await reasons(res(401, "")), "UNAUTHORIZED");
  assert.equal(await reasons(res(403, "")), "UNAUTHORIZED");
  assert.equal(await reasons(res(404, "")), "NOT_FOUND");
  assert.equal(await reasons(res(503, "")), "SERVER_ERROR");
  assert.equal(await reasons(res(302, "", { location: "http://169.254.169.254/" })), "BAD_REPLY", "a redirect is not followed");
  assert.equal(await reasons(res(200, "<html>not json</html>")), "BAD_REPLY");
  assert.equal(await reasons(res(200, "{}", { "content-length": String(50 * 1024 * 1024) })), "TOO_BIG");
  assert.equal(await reasons(() => { throw new Error("connect ECONNREFUSED"); }), "UNREACHABLE");
  const abort = () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; };
  assert.equal(await reasons(abort), "TIMEOUT");
  const lookupFails = new SafeConnectorHttp(async () => { throw new Error("ENOTFOUND"); });
  assert.deepEqual(await lookupFails.get("https://nowhere.example.org/x", {}), { ok: false, reason: "UNREACHABLE" });
});
