// Phase 38.2: the Project and team slide's pure rules.
import test from "node:test";
import assert from "node:assert/strict";
import { ALL_ROLES } from "@donordesk/domain";
import { EMPTY_PERSON, FACT_FIELDS, ROLE_LABEL, TEAM_ROLES, addPersonOperation, factChanged, factEdit, newPersonKey, roleLabel } from "../../src/features/project-setup/pcw/domain/team-view.ts";

const person = (key: string) => ({ key, name: key, email: null, role: "VIEWER", external: false, invite: "LATER" as const });

test("every offered role is a real role and has a name a person can read", () => {
  for (const role of TEAM_ROLES) {
    assert.ok(ALL_ROLES.includes(role), role);
    assert.ok(ROLE_LABEL[role].length > 3);
    assert.equal(/[_A-Z]{4,}/.test(roleLabel(role)), false, "no raw role code");
  }
  assert.ok(!TEAM_ROLES.includes("ADMIN" as never), "an administrator is not added as a project role");
});

test("a person's key is readable and unique among the team", () => {
  assert.equal(newPersonKey([], "Amina Okello"), "p-amina-okello");
  assert.equal(newPersonKey([person("p-amina-okello")], "Amina Okello"), "p-amina-okello-2");
  assert.equal(newPersonKey([], "  ??? "), "p-person");
});

test("adding a person needs a name, and an email to invite now", () => {
  assert.equal(addPersonOperation([], { ...EMPTY_PERSON, name: " " }).ok, false);
  const now = addPersonOperation([], { ...EMPTY_PERSON, name: "Ali", invite: "NOW" });
  assert.equal(now.ok, false);
  const later = addPersonOperation([], { ...EMPTY_PERSON, name: "Ali", invite: "LATER", role: "PROJECT_MANAGER" });
  assert.equal(later.ok, true);
  if (later.ok) assert.deepEqual(later.operation, { kind: "ADD_PERSON", person: { key: "p-ali", name: "Ali", email: null, role: "PROJECT_MANAGER", external: false, invite: "LATER" } });
});

test("a fact is stored as an edit; clearing is null, a currency is upper case, an untouched field saves nothing", () => {
  assert.deepEqual(factEdit("name", "  Wells  "), { area: "FACTS", path: "facts.name", op: "EDIT", value: "Wells" });
  assert.equal(factEdit("code", "   ").value, null);
  assert.equal(factEdit("currency", "eur").value, "EUR");
  const view = { facts: { name: "Wells", code: null, startDate: null, endDate: null, currency: null, summary: null } } as never;
  assert.equal(factChanged(view, "name", " Wells "), false);
  assert.equal(factChanged(view, "code", ""), false);
  assert.equal(factChanged(view, "code", "A1"), true);
});

test("the fact fields are the facts the requirement asks for", () => {
  assert.deepEqual(FACT_FIELDS.map((f) => f.key).sort(), ["code", "currency", "endDate", "name", "startDate", "summary"]);
});
