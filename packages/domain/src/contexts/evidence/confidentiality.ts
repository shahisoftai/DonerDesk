/**
 * Who may open a piece of evidence, by its confidentiality level.
 *
 * A level names the permission that opens it. PUBLIC and INTERNAL are open to
 * anyone who may view the project; SENSITIVE needs `evidence.upload` (the
 * roles that may bring evidence in); HIGHLY_SENSITIVE needs `evidence.verify`
 * (the roles accountable for what is verified) or
 * `report.override-confidentiality` (the roles that may put it in a donor
 * report, and so must be able to open it). A VIEWER holds none of them, so a
 * viewer can browse ordinary evidence but never opens a restricted file.
 *
 * The person who uploaded a file can always open their own.
 *
 * The same rule governs the record (`GET /v1/evidence/:id`), the list
 * (`POST /v1/evidence/search`) and the bytes (`GET /v1/files/:key`), so a
 * label can never be more protective than the download.
 */
import type { Role } from "../identity/role.js";
import { Permissions, type Permission } from "../../policies/permissions.js";
import type { ConfidentialityLevel } from "./evidence-file.js";

export const CONFIDENTIALITY_READERS: Readonly<Record<ConfidentialityLevel, readonly Permission[]>> = {
  PUBLIC: [],
  INTERNAL: [],
  SENSITIVE: ["evidence.upload"],
  HIGHLY_SENSITIVE: ["evidence.verify", "report.override-confidentiality"],
};

/** The levels a report writer is never given, whatever the reader's role. */
export const RESTRICTED_CONFIDENTIALITY_LEVELS: ReadonlySet<ConfidentialityLevel> = new Set<ConfidentialityLevel>([
  "SENSITIVE",
  "HIGHLY_SENSITIVE",
]);

export interface EvidenceReader {
  userId: string;
  role: Role;
}

export function isRestrictedConfidentiality(level: ConfidentialityLevel): boolean {
  return RESTRICTED_CONFIDENTIALITY_LEVELS.has(level);
}

/** Whether this role may open evidence at this level at all. */
export function mayReadConfidentiality(role: Role, level: ConfidentialityLevel): boolean {
  const permissions = CONFIDENTIALITY_READERS[level];
  if (permissions.length === 0) return true;
  return permissions.some((permission) => Permissions.can(role, permission));
}

/** Whether this person may open this file: by level, or because they uploaded it. */
export function mayReadEvidence(reader: EvidenceReader, evidence: { confidentialityLevel: ConfidentialityLevel; uploadedById: string }): boolean {
  if (reader.userId === evidence.uploadedById) return true;
  return mayReadConfidentiality(reader.role, evidence.confidentialityLevel);
}

/** The levels this role may open — used to filter the evidence list. */
export function readableConfidentialityLevels(role: Role): ConfidentialityLevel[] {
  return (Object.keys(CONFIDENTIALITY_READERS) as ConfidentialityLevel[]).filter((level) => mayReadConfidentiality(role, level));
}
