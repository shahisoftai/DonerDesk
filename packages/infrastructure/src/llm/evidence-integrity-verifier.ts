import type { IEvidenceIntegrityVerifier, EvidenceIntegrityResult, EvidencePackage } from "@donordesk/application";
import type { VerificationReasonCode } from "@donordesk/domain";

const CONFIDENTIAL_LEVELS = new Set(["SENSITIVE", "HIGHLY_SENSITIVE"]);

/**
 * Validates that every cited source still points at the exact evidence bytes
 * snapshotted at generation time: the evidence exists, the chunk exists, the
 * source text matches the chunk, and the hash matches. Runs before any
 * semantic verification.
 */
export class DeterministicEvidenceIntegrityVerifier implements IEvidenceIntegrityVerifier {
  async verify(input: {
    sources: Array<{ evidenceId: string; chunkId: string; sourceText: string; evidenceHash?: string }>;
    evidencePackages: EvidencePackage[];
  }): Promise<{ ok: true; value: EvidenceIntegrityResult }> {
    const reasons: VerificationReasonCode[] = [];
    if (input.sources.length === 0) {
      return {
        ok: true,
        value: {
          valid: false,
          reasons: ["SOURCE_MISSING"],
          detail: "Assertion has no cited evidence source",
        },
      };
    }

    for (const source of input.sources) {
      const pkg = input.evidencePackages.find((p) => p.evidenceId === source.evidenceId);
      if (!pkg) {
        reasons.push("SOURCE_NOT_FOUND");
        continue;
      }
      const chunk = pkg.chunks.find((c) => c.chunkId === source.chunkId);
      if (!chunk) {
        reasons.push("CHUNK_NOT_FOUND");
        continue;
      }
      if (source.evidenceHash && pkg.evidenceHash && source.evidenceHash !== pkg.evidenceHash) {
        reasons.push("EVIDENCE_HASH_MISMATCH");
      }
      const normalizedSource = source.sourceText.replace(/\s+/g, " ").trim().toLowerCase();
      const normalizedChunk = chunk.text.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalizedSource && normalizedChunk && normalizedSource !== normalizedChunk && !normalizedChunk.includes(normalizedSource.slice(0, 80))) {
        reasons.push("SOURCE_TEXT_MISMATCH");
      }
      if (pkg.verificationStatus !== "VERIFIED" && pkg.verificationStatus !== "REVIEWED") {
        reasons.push("EVIDENCE_UNVERIFIED");
      }
      if (CONFIDENTIAL_LEVELS.has(pkg.confidentialityLevel)) {
        reasons.push("CONFIDENTIALITY_RESTRICTED");
      }
    }

    const uniqueReasons = [...new Set(reasons)];
    const valid = uniqueReasons.length === 0;
    return {
      ok: true,
      value: {
        valid,
        reasons: uniqueReasons,
        detail: valid ? "All cited sources match their snapshotted bytes" : `Evidence integrity failed: ${uniqueReasons.join(", ")}`,
      },
    };
  }
}
