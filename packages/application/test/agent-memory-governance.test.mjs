import assert from "node:assert/strict";
import test from "node:test";
import { ApproveAgentMemoryHandler, RejectAgentMemoryHandler, DeactivateAgentMemoryHandler } from "../dist/index.js";

function makeMemory(status = "PROPOSED") {
  return {
    id: "mem-1",
    status,
    scope: "SECTION_TYPE",
    scopeId: "Executive Summary",
    statement: "Prefer active voice.",
    approve(actorId) { this.status = "ACTIVE"; this.approvedById = actorId; },
    reject() { this.status = "REJECTED"; },
    deactivate() { this.status = "DEACTIVATED"; },
  };
}

function makeRepo(memory) {
  return {
    findById: async () => ({ ok: true, value: memory }),
    update: async (m) => ({ ok: true, value: m }),
  };
}

const audit = { record: async () => {} };

const reportManagerCtx = { tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-1", role: "ADMIN" }, requestId: "r" };
const viewerCtx = { tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-2", role: "VIEWER" }, requestId: "r" };

test("ApproveAgentMemoryHandler denies a role without report.manage-agent-memory", async () => {
  const memory = makeMemory();
  const handler = new ApproveAgentMemoryHandler(makeRepo(memory), audit);
  const result = await handler.handle(viewerCtx, "mem-1");
  assert.ok(!result.ok);
  assert.equal(result.error.code, "FORBIDDEN");
  assert.equal(memory.status, "PROPOSED");
});

test("ApproveAgentMemoryHandler approves and persists for a report manager", async () => {
  const memory = makeMemory();
  const handler = new ApproveAgentMemoryHandler(makeRepo(memory), audit);
  const result = await handler.handle(reportManagerCtx, "mem-1");
  assert.ok(result.ok);
  assert.equal(memory.status, "ACTIVE");
  assert.equal(memory.approvedById, "user-1");
});

test("RejectAgentMemoryHandler rejects for a report manager", async () => {
  const memory = makeMemory();
  const handler = new RejectAgentMemoryHandler(makeRepo(memory), audit);
  const result = await handler.handle(reportManagerCtx, "mem-1");
  assert.ok(result.ok);
  assert.equal(memory.status, "REJECTED");
});

test("DeactivateAgentMemoryHandler pauses an ACTIVE memory for a report manager", async () => {
  const memory = makeMemory("ACTIVE");
  const handler = new DeactivateAgentMemoryHandler(makeRepo(memory), audit);
  const result = await handler.handle(reportManagerCtx, "mem-1");
  assert.ok(result.ok);
  assert.equal(memory.status, "DEACTIVATED");
});

test("DeactivateAgentMemoryHandler denies a viewer", async () => {
  const memory = makeMemory("ACTIVE");
  const handler = new DeactivateAgentMemoryHandler(makeRepo(memory), audit);
  const result = await handler.handle(viewerCtx, "mem-1");
  assert.ok(!result.ok);
  assert.equal(result.error.code, "FORBIDDEN");
});
