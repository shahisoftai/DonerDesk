import type { IReportDraftGenerator, GeneratedSection, ReportClaimDraft } from "@donordesk/application";
import type { SourceReference, VerifiedFinding } from "@donordesk/domain";

/**
 * Heuristic, deterministic draft generator (no LLM). Narrates verified
 * findings and evidence packages only: it never computes indicator values and
 * never invents numbers. Emits structured claims that are verified
 * downstream. The LLM-backed generator is a later swap point with the same
 * contract.
 */
export class StubReportDraftGenerator implements IReportDraftGenerator {
  async generateDraft(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): ReturnType<IReportDraftGenerator["generateDraft"]> {
    const sections: GeneratedSection[] = [];
    const planSections = input.reportPlan.sections;
    const findings = input.verifiedFindings;

    for (const planSection of planSections) {
      const titleLower = planSection.title.toLowerCase();
      if (titleLower.includes("executive summary")) {
        sections.push(this.executiveSummary(input, planSection.title));
      } else if (titleLower.includes("indicator")) {
        sections.push(this.indicatorProgress(input, planSection.title));
      } else if (titleLower.includes("achievement")) {
        sections.push(this.achievements(input, planSection.title));
      } else if (titleLower.includes("challenge")) {
        sections.push(this.challenges(input, planSection.title));
      } else if (titleLower.includes("lesson")) {
        sections.push(this.lessons(input, planSection.title));
      } else if (titleLower.includes("annex")) {
        sections.push(this.annexList(input, planSection.title));
      } else {
        sections.push({
          sectionId: planSection.templateSectionId,
          title: planSection.title,
          content: this.descriptiveNarrative(input, planSection.title),
          claims: findings.slice(0, 3).map((f) => this.numericClaim(f)),
          sourceReferences: findings.slice(0, 3).map((f) => ({
            type: "indicator" as const,
            id: f.indicatorId,
            label: `${f.indicatorCode}`,
          })),
        });
      }
    }

    return sections;
  }

  async rewriteSection(input: {
    sectionTitle: string;
    content: string;
    mode: "REWRITE" | "SHORTEN";
    audience: "DONOR" | "INTERNAL" | "GENERAL";
    instructions?: string;
    sourceReferences: SourceReference[];
  }): ReturnType<IReportDraftGenerator["rewriteSection"]> {
    const source = (input.content ?? "").trim();
    if (!source) {
      return { content: "", unsupportedClaims: ["Section is empty; nothing to rewrite"] };
    }

    const needsVerification = source.includes("[Needs verification]") || source.includes("[Needs source verification]");
    const unsupported: string[] = needsVerification ? ["Review claims flagged for source verification"] : [];

    if (input.mode === "SHORTEN") {
      return {
        content: this.shorten(source, input.audience),
        unsupportedClaims: unsupported,
      };
    }

    return {
      content: this.rewrite(source, input.audience, input.instructions),
      unsupportedClaims: unsupported,
    };
  }

  private numericClaim(finding: VerifiedFinding): ReportClaimDraft {
    return {
      text: `${finding.indicatorCode}: ${finding.value}${finding.unit ? ` ${finding.unit}` : ""} reported for the period`,
      type: "NUMERIC",
      proposedSources: [],
    };
  }

  private evidenceClaim(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], index: number): ReportClaimDraft {
    const pkg = input.evidencePackages[index];
    const chunk = pkg?.chunks[0];
    return {
      text: pkg ? `${pkg.title} documents activity output for the period` : "",
      type: "FACTUAL",
      proposedSources: pkg && chunk
        ? [{ evidenceId: pkg.evidenceId, chunkId: chunk.chunkId, sourceText: chunk.text }]
        : [],
    };
  }

  private evidenceRefs(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): SourceReference[] {
    return input.evidencePackages.map((p) => ({
      type: "evidence" as const,
      id: p.evidenceId,
      label: p.title,
    }));
  }

  private executiveSummary(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const findings = input.verifiedFindings;
    const claims = findings.map((f) => this.numericClaim(f));
    const lines = [
      `This report summarises implementation progress during the reporting period.`,
      `${findings.length} indicator finding(s) and ${input.evidencePackages.length} evidence file(s) support the claims below.`,
    ];
    for (const f of findings.slice(0, 5)) {
      lines.push(this.describeFinding(f));
    }
    return {
      sectionId: "exec-summary",
      title,
      content: lines.join("\n\n"),
      claims,
      sourceReferences: findings.slice(0, 5).map((f) => ({ type: "indicator", id: f.indicatorId, label: f.indicatorCode })),
    };
  }

  private indicatorProgress(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const findings = input.verifiedFindings;
    const rows = findings.map((f) => {
      const flags = f.qualityFlags.length > 0 ? ` (flags: ${f.qualityFlags.join(", ")})` : "";
      return `| ${f.indicatorCode} | ${f.value}${f.unit ? ` ${f.unit}` : ""} | ${f.calculationMethod} |${flags} |`;
    });
    const claims = findings.map((f) => this.numericClaim(f));
    const content = findings.length === 0
      ? "No verified indicator findings are available for this period."
      : ["| Indicator | Value | Method |", "| --- | --- | --- |", ...rows].join("\n");
    return {
      sectionId: "indicator-progress",
      title,
      content,
      claims,
      sourceReferences: findings.map((f) => ({ type: "indicator", id: f.indicatorId, label: f.indicatorCode })),
    };
  }

  private achievements(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const claims: ReportClaimDraft[] = [];
    const refs: SourceReference[] = [];
    const lines: string[] = [];
    input.evidencePackages.slice(0, 10).forEach((p, index) => {
      const chunk = p.chunks[0];
      lines.push(`- ${p.title}`);
      refs.push({ type: "evidence", id: p.evidenceId, label: p.title });
      claims.push({
        text: `${p.title} records delivered outputs for the period`,
        type: "QUALITATIVE",
        proposedSources: chunk ? [{ evidenceId: p.evidenceId, chunkId: chunk.chunkId, sourceText: chunk.text }] : [],
      });
      if (index === 0 && chunk) {
        lines.push(`  ${chunk.text.slice(0, 200)}`);
      }
    });
    const content = lines.length === 0 ? "No documented achievements available for this period." : lines.join("\n");
    return {
      sectionId: "achievements",
      title,
      content,
      claims,
      sourceReferences: refs,
    };
  }

  private challenges(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    return {
      sectionId: "challenges",
      title,
      content: "Challenges were flagged through the compliance checklist and activity updates; none are claimed here without verified sources.",
      claims: [],
      sourceReferences: [],
    };
  }

  private lessons(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    return {
      sectionId: "lessons",
      title,
      content: "Lessons learned are recorded per activity update and reviewed before inclusion in the final report.",
      claims: [],
      sourceReferences: [],
    };
  }

  private annexList(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const refs = this.evidenceRefs(input);
    return {
      sectionId: "annex-list",
      title,
      content: refs.length === 0
        ? "No evidence is attached yet."
        : `The evidence pack contains ${refs.length} file(s). Refer to the export for the full annex list.`,
      claims: refs.length > 0 ? [this.evidenceClaim(input, 0)].filter((c) => c.text) : [],
      sourceReferences: refs,
    };
  }

  private descriptiveNarrative(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): string {
    const findings = input.verifiedFindings;
    if (findings.length === 0) {
      return `[Drafted from verified findings, report plan, and evidence. No findings available this period.]`;
    }
    return findings.slice(0, 5).map((f) => this.describeFinding(f)).join("\n\n");
  }

  private describeFinding(finding: VerifiedFinding): string {
    // Descriptive-only narrative: the stub cannot see indicator semantics, so
    // it never attaches evaluative wording. Claims are verified downstream.
    const flags = finding.qualityFlags.length > 0 ? ` (${finding.qualityFlags.join(", ")})` : "";
    return `${finding.indicatorCode}: ${finding.value}${finding.unit ? ` ${finding.unit}` : ""} recorded via ${finding.calculationMethod}${flags}.`;
  }

  private shorten(content: string, audience: "DONOR" | "INTERNAL" | "GENERAL"): string {
    const paragraphs = content.split(/\n{2,}/);
    const out: string[] = [];
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("|") || trimmed.startsWith("-") || trimmed.startsWith("1.")) {
        out.push(trimmed);
        continue;
      }
      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      if (sentences.length <= 1) {
        out.push(trimmed);
        continue;
      }
      out.push(sentences.slice(0, 2).join(" "));
    }
    const joined = out.join("\n\n");
    if (audience === "DONOR" && !joined.endsWith(".")) return `${joined}.`;
    return joined;
  }

  private rewrite(content: string, audience: "DONOR" | "INTERNAL" | "GENERAL", instructions?: string): string {
    let text = content.replace(/\[Needs verification\]/g, "").replace(/\[Needs source verification\]/g, "").trim();
    if (audience === "DONOR") {
      text = text.replace(/\bgot\b/g, "received").replace(/\bwanna\b/g, "intend to");
      text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, pre, ch) => `${pre}${(ch as string).toUpperCase()}`);
    }
    if (audience === "INTERNAL") {
      text = text.replace(/^\*\*/g, "").replace(/\*\*$/g, "");
    }
    if (instructions && instructions.trim()) {
      text = `${text}\n\n[Editor note: ${instructions.trim()}]`;
    }
    return text;
  }
}
