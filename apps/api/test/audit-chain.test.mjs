import { describe, it } from "node:test";
import assert from "node:assert";
import { computeAuditHash as computeHash } from "@donordesk/infrastructure";

process.env.AUDIT_CHAIN_KEY = "test-audit-chain-key-with-at-least-32-characters";

describe("audit chain", () => {
  it("genesis block uses GENESIS as prevHash", () => {
    const genesisHash = computeHash({
      id: "evt-001",
      tenantId: "tenant-1",
      actorId: "user-1",
      eventType: "user.login",
      entityType: "user",
      entityId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      prevHash: "GENESIS",
    });
    assert.ok(genesisHash, "genesis hash computed");
    assert.strictEqual(genesisHash.length, 64);
  });

  it("subsequent block uses previous hash as prevHash", () => {
    const firstHash = computeHash({
      id: "evt-001",
      tenantId: "tenant-1",
      actorId: "user-1",
      eventType: "user.login",
      entityType: "user",
      entityId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      prevHash: "GENESIS",
    });

    const secondHash = computeHash({
      id: "evt-002",
      tenantId: "tenant-1",
      actorId: "user-1",
      eventType: "project.created",
      entityType: "project",
      entityId: "proj-1",
      createdAt: new Date("2026-01-01T00:01:00Z"),
      prevHash: firstHash,
    });

    assert.ok(secondHash, "second hash computed");
    assert.notStrictEqual(secondHash, firstHash);
  });

  it("tampering with a block breaks the chain", () => {
    const firstHash = computeHash({
      id: "evt-001",
      tenantId: "tenant-1",
      actorId: "user-1",
      eventType: "user.login",
      entityType: "user",
      entityId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      prevHash: "GENESIS",
    });

    const secondHash = computeHash({
      id: "evt-002",
      tenantId: "tenant-1",
      actorId: "user-1",
      eventType: "project.created",
      entityType: "project",
      entityId: "proj-1",
      createdAt: new Date("2026-01-01T00:01:00Z"),
      prevHash: firstHash,
    });

    const tamperedSecondHash = computeHash({
      id: "evt-002",
      tenantId: "tenant-1",
      actorId: "hacker",
      eventType: "project.created",
      entityType: "project",
      entityId: "proj-1",
      createdAt: new Date("2026-01-01T00:01:00Z"),
      prevHash: firstHash,
    });

    assert.notStrictEqual(secondHash, tamperedSecondHash, "tampering changes hash");
  });

  it("different tenant has independent chain", () => {
    const hashA = computeHash({
      id: "evt-001",
      tenantId: "tenant-A",
      actorId: "user-1",
      eventType: "user.login",
      entityType: "user",
      entityId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      prevHash: "GENESIS",
    });

    const hashB = computeHash({
      id: "evt-001",
      tenantId: "tenant-B",
      actorId: "user-1",
      eventType: "user.login",
      entityType: "user",
      entityId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      prevHash: "GENESIS",
    });

    assert.notStrictEqual(hashA, hashB, "different tenant produces different hash");
  });
});
