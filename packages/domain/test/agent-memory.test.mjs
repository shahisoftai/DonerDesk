import assert from "node:assert/strict";
import test from "node:test";
import { AgentMemory, TenantId, excludeNumericHunks, containsNumericContent, DomainError } from "../dist/index.js";

function propose(overrides = {}) {
  return AgentMemory.propose({
    id: "mem-1",
    tenantId: TenantId.create("tenant-a"),
    scope: "SECTION_TYPE",
    scopeId: "Executive Summary",
    category: "TONE",
    statement: "Prefer active voice over passive constructions.",
    provenance: {
      sourceRevisionId: "rev-2",
      parentRevisionId: "rev-1",
      sectionId: "sec-1",
      occurrenceCount: 1,
      lastObservedAt: new Date("2026-01-01T00:00:00Z"),
    },
    ...overrides,
  });
}

test("AgentMemory always starts PROPOSED and cannot be constructed already active", () => {
  const memory = propose();
  assert.equal(memory.status, "PROPOSED");
  assert.equal(memory.approvedById, null);
});

test("PROPOSED -> ACTIVE requires approve() and carries approvedById", () => {
  const memory = propose();
  memory.approve("user-1");
  assert.equal(memory.status, "ACTIVE");
  assert.equal(memory.approvedById, "user-1");
  assert.ok(memory.approvedAt instanceof Date);
});

test("PROPOSED -> REJECTED is legal; REJECTED cannot transition further", () => {
  const memory = propose();
  memory.reject();
  assert.equal(memory.status, "REJECTED");
  assert.throws(() => memory.approve("user-1"), (err) => err instanceof DomainError && err.code === "INVALID_STATE_TRANSITION");
});

test("ACTIVE -> DEACTIVATED and ACTIVE -> SUPERSEDED are legal", () => {
  const paused = propose();
  paused.approve("user-1");
  paused.deactivate();
  assert.equal(paused.status, "DEACTIVATED");

  const superseded = propose();
  superseded.approve("user-1");
  superseded.supersede();
  assert.equal(superseded.status, "SUPERSEDED");
});

test("illegal transitions are rejected: PROPOSED -> DEACTIVATED, REJECTED -> ACTIVE, ACTIVE -> PROPOSED", () => {
  const memory = propose();
  assert.throws(() => memory.deactivate(), (err) => err instanceof DomainError && err.code === "INVALID_STATE_TRANSITION");

  const rejected = propose();
  rejected.reject();
  assert.throws(() => rejected.approve("user-1"), (err) => err instanceof DomainError && err.code === "INVALID_STATE_TRANSITION");

  const active = propose();
  active.approve("user-1");
  assert.throws(() => active.reject(), (err) => err instanceof DomainError && err.code === "INVALID_STATE_TRANSITION");
});

test("reinforce() bumps occurrence count and confidence instead of creating a duplicate", () => {
  const memory = propose();
  assert.equal(memory.confidence, "LOW");
  memory.reinforce({ sourceRevisionId: "rev-4", parentRevisionId: "rev-3", sectionId: "sec-1", occurrenceCount: 4, lastObservedAt: new Date() });
  assert.equal(memory.occurrenceCount, 5);
  assert.equal(memory.confidence, "HIGH");
  assert.equal(memory.provenance.length, 2);
});

test("layer 2 defence: a statement carrying a numeric atom cannot be constructed even if extraction-time filtering somehow missed it", () => {
  assert.throws(
    () => propose({ statement: "Report 45 participants trained this quarter." }),
    (err) => err instanceof DomainError && err.code === "VALIDATION_FAILED" && err.details?.reason === "numeric_content",
  );
});

test("containsNumericContent flags numeric tokens, currency, percentages, and dates; plain style text passes", () => {
  assert.equal(containsNumericContent("Trained 12 volunteers"), true);
  assert.equal(containsNumericContent("Spent $500 on supplies"), true);
  assert.equal(containsNumericContent("Achieved 80% of the target"), true);
  assert.equal(containsNumericContent("Reported on 2026-01-15"), true);
  assert.equal(containsNumericContent("Prefer active voice throughout"), false);
});

test("excludeNumericHunks drops only the numeric-bearing paragraph, keeping style-only paragraphs intact", () => {
  const text = [
    "The project trained volunteers across the region.",
    "This quarter, 45 participants attended the workshop.",
    "Reviewers consistently prefer shorter, punchier sentences.",
  ].join("\n\n");
  const filtered = excludeNumericHunks(text);
  assert.ok(filtered.includes("trained volunteers"));
  assert.ok(filtered.includes("punchier sentences"));
  assert.ok(!filtered.includes("45 participants"));
});

test("excludeNumericHunks leaves fully numeric-free text unchanged", () => {
  const text = "Write in the active voice.\n\nAvoid bureaucratic phrasing.";
  assert.equal(excludeNumericHunks(text), text);
});
