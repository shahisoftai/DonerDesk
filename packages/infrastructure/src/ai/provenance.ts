export interface ProvenanceClaim {
  text: string;
  evidenceId: string;
  chunkId: string;
  score: number;
  sourceText?: string;
}

export interface ProvenanceParagraph {
  text: string;
  claims: ProvenanceClaim[];
  needsVerification: boolean;
  verificationNote?: string;
}

export interface ProvenanceContext {
  projectId: string;
  tenantId: string;
  periodId: string;
  generatedAt: Date;
  modelId: string;
  promptVersion: number;
  threshold: number;
}

export class ProvenanceTracker {
  private readonly threshold: number;

  constructor(thmark = 0.7) {
    if (!Number.isFinite(thmark) || thmark < 0 || thmark > 1) throw new Error("Provenance threshold must be between 0 and 1");
    this.threshold = thmark;
  }

  buildParagraph(
    claims: Array<{
      text: string;
      evidenceId: string;
      chunkId: string;
      score: number;
      sourceText?: string;
    }>,
    context: ProvenanceContext,
  ): ProvenanceParagraph {
    for (const claim of claims) {
      if (!claim.text.trim() || !claim.evidenceId || !claim.chunkId) throw new Error("Every provenance claim requires text, evidence ID, and chunk ID");
      if (!Number.isFinite(claim.score) || claim.score < 0 || claim.score > 1) throw new Error("Provenance scores must be between 0 and 1");
    }
    const unverifiedClaims = claims.filter((c) => c.score < this.threshold);

    const paragraphText = claims.map((c) => {
      const citation = `[${c.evidenceId}:${c.chunkId}:${c.score.toFixed(2)}]`;
      return `${c.text} ${citation}`;
    }).join(" ");

    return {
      text: paragraphText,
      claims: claims.map((c) => ({
        text: c.text,
        evidenceId: c.evidenceId,
        chunkId: c.chunkId,
        score: c.score,
        sourceText: c.sourceText,
      })),
      needsVerification: claims.length === 0 || unverifiedClaims.length > 0,
      verificationNote: claims.length === 0
        ? "No source-linked claims were provided; verification is required"
        : unverifiedClaims.length > 0
        ? `${unverifiedClaims.length} claim(s) scored below ${this.threshold} threshold and need verification`
        : undefined,
    };
  }

  formatInlineProvenance(claim: ProvenanceClaim): string {
    return `${claim.text} [${claim.evidenceId},${claim.chunkId},${claim.score.toFixed(2)}]`;
  }

  formatSourceReference(claim: ProvenanceClaim): string {
    return `Source: ${claim.evidenceId} (chunk ${claim.chunkId}, confidence ${(claim.score * 100).toFixed(0)}%)`;
  }
}

export function createProvenanceTracker(threshold = 0.7): ProvenanceTracker {
  return new ProvenanceTracker(threshold);
}
