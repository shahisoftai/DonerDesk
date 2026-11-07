import { createHash } from "node:crypto";
import type { StoredCanvasShareLink } from "../../ports/canvas.js";

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
export interface CanvasShareLinkDto { id: string; kind: "LIVE" | "FROZEN"; label: string; exportId?: string; expiresAt: string; revoked: boolean; expired: boolean }
export const linkDto = (l: StoredCanvasShareLink, now: Date): CanvasShareLinkDto => ({ id: l.id, kind: l.kind, label: l.label, ...(l.exportId ? { exportId: l.exportId } : {}), expiresAt: l.expiresAt.toISOString(), revoked: Boolean(l.revokedAt), expired: l.expiresAt <= now });
