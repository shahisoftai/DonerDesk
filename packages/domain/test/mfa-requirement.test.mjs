import test from "node:test";
import assert from "node:assert/strict";
import { mfaGate, mfaRequiredFrom, isAllowedBeforeMfaSetup, MFA_GRACE_CHOICES } from "../dist/index.js";

const now = new Date("2026-10-10T08:00:00Z");
const later = new Date("2026-10-17T08:00:00Z");

test("before the day people are reminded, from the day a person without it can only set it up, and anyone who has it is done", () => {
  const g = (over) => mfaGate({ requiredFrom: later, now, userHasMfa: false, ssoManaged: false, ...over });
  assert.equal(g({ requiredFrom: null }), "NOT_REQUIRED");
  assert.equal(g({ requiredFrom: undefined }), "NOT_REQUIRED");
  assert.equal(g({}), "REQUIRED_SOON");
  assert.equal(g({ now: later }), "SETUP_REQUIRED");
  assert.equal(g({ now: new Date("2026-12-01T00:00:00Z") }), "SETUP_REQUIRED");
  assert.equal(g({ userHasMfa: true, now: later }), "DONE");
  assert.equal(g({ ssoManaged: true, now: later }), "NOT_REQUIRED", "with single sign-on the identity provider owns it");
});

test("the day it starts follows the grace chosen; an unknown choice falls back to a week", () => {
  assert.deepEqual(MFA_GRACE_CHOICES, [0, 7, 14, 30]);
  assert.equal(mfaRequiredFrom(now, 0).getTime(), now.getTime());
  assert.equal(mfaRequiredFrom(now, 7).toISOString(), "2026-10-17T08:00:00.000Z");
  assert.equal(mfaRequiredFrom(now, 30).toISOString(), "2026-11-09T08:00:00.000Z");
  assert.equal(mfaRequiredFrom(now, 3).toISOString(), "2026-10-17T08:00:00.000Z");
});

test("before setup, only the two-step routes and sign-out are reachable", () => {
  for (const ok of ["/v1/auth/mfa", "/v1/auth/mfa/setup", "/v1/auth/mfa/enable", "/v1/auth/mfa?x=1", "/v1/auth/logout"]) assert.equal(isAllowedBeforeMfaSetup(ok), true, ok);
  for (const no of ["/v1/projects", "/v1/organization", "/v1/auth/mfa/disable", "/v1/auth/password/change", "/v1/auth/mfa/setup/x", "/v1/users"]) assert.equal(isAllowedBeforeMfaSetup(no), false, no);
});
