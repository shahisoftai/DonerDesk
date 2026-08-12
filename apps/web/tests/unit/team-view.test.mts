import { test } from "node:test";
import assert from "node:assert/strict";
import { filterTeamMembers } from "../../src/features/team/application/team-view.ts";

const members = [
  { id: "1", name: "Alice Smith", email: "alice@example.org", role: "ADMIN", status: "ACTIVE" },
  { id: "2", name: "Bob Jones", email: "bob@example.org", role: "FIELD_OFFICER", status: "ACTIVE" },
  { id: "3", name: "Carol", email: "carol@example.org", role: "VIEWER", status: "INVITED" },
];

test("no filter returns all members", () => {
  assert.equal(filterTeamMembers(members, {}).length, 3);
});

test("query matches name or email, case-insensitive", () => {
  assert.equal(filterTeamMembers(members, { query: "alice" }).length, 1);
  assert.equal(filterTeamMembers(members, { query: "example" }).length, 3);
  assert.equal(filterTeamMembers(members, { query: "BOB" }).length, 1);
  assert.equal(filterTeamMembers(members, { query: "nope" }).length, 0);
});

test("role filter narrows results", () => {
  const result = filterTeamMembers(members, { role: "FIELD_OFFICER" });
  assert.equal(result.length, 1);
  assert.equal(result[0]!.name, "Bob Jones");
});

test("combined query and role filter", () => {
  const result = filterTeamMembers(members, { query: "example", role: "ADMIN" });
  assert.equal(result.length, 1);
  assert.equal(result[0]!.name, "Alice Smith");
});
