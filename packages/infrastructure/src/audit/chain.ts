import { createHmac } from "node:crypto";

export interface AuditChainRecord {
  id: string;
  tenantId: string;
  actorId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  projectId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  systemNote?: string;
  createdAt: Date;
  prevHash: string;
}

export function resolveAuditChainKey(): string {
  const key = process.env.AUDIT_CHAIN_KEY;
  if (key && key.length >= 32) return key;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUDIT_CHAIN_KEY must contain at least 32 characters in production");
  }
  return "development-only-audit-chain-key-change-me";
}

export function computeAuditHash(input: AuditChainRecord, key = resolveAuditChainKey()): string {
  const content = [
    input.id,
    input.tenantId,
    input.actorId,
    input.eventType,
    input.entityType,
    input.entityId,
    input.projectId ?? "",
    input.oldValue ?? "",
    input.newValue ?? "",
    input.ipAddress ?? "",
    input.systemNote ?? "",
    input.createdAt.toISOString(),
    input.prevHash,
  ].join("|");
  return createHmac("sha256", key).update(content).digest("hex");
}
