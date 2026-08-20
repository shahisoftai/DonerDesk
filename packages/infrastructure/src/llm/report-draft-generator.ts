import type { IReportDraftGenerator, GeneratedSection, GeneratedSectionResult, ReportClaimDraft } from "@donordesk/application";
import type { ReportPlanSection, SourceReference, VerifiedFinding } from "@donordesk/domain";

/**
 * Heuristic, deterministic draft generator (no LLM). Narrates verified
 * findings, activity records, and evidence packages only: it never computes
 * indicator values and never invents numbers. Emits structured claims that are
 * verified downstream. The LLM-backed generator is a later swap point with the
 * same contract.
 */
export class StubReportDraftGenerator implements IReportDraftGenerator {
  readonly model = { modelId: "stub", modelVersion: "stub-v1", promptVersion: 1 } as const;

  async generateDraft(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): ReturnType<IReportDraftGenerator["generateDraft"]> {
    const sections: GeneratedSection[] = [];
    const planSections = input.reportPlan.sections;

    for (const planSection of planSections) {
      sections.push(this.buildSection(input, planSection));
    }

    return { sections, usedFallback: true, fallbackReason: "PROVIDER_NOT_CONFIGURED" };
  }

  async generateSection(
    input: Parameters<IReportDraftGenerator["generateSection"]>[0],
    planSection: ReportPlanSection,
  ): Promise<GeneratedSectionResult> {
    return { section: this.buildSection(input, planSection), usedFallback: true, fallbackReason: "PROVIDER_NOT_CONFIGURED" };
  }

  private buildSection(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], planSection: ReportPlanSection): GeneratedSection {
    const titleLower = planSection.title.toLowerCase();
    if (titleLower.includes("executive summary")) {
      return this.executiveSummary(input, planSection.title);
    }
    if (titleLower.includes("indicator")) {
      return this.indicatorProgress(input, planSection.title);
    }
    if (titleLower.includes("activity")) {
      return this.activityNarrative(input, planSection.title);
    }
    if (titleLower.includes("achievement")) {
      return this.achievements(input, planSection.title);
    }
    if (titleLower.includes("challenge")) {
      return this.challenges(input, planSection.title);
    }
    if (titleLower.includes("lesson")) {
      return this.lessons(input, planSection.title);
    }
    if (titleLower.includes("annex")) {
      return this.annexList(input, planSection.title);
    }
    return {
      sectionId: planSection.templateSectionId,
      title: planSection.title,
      content: this.descriptiveNarrative(input, planSection.title),
      claims: findingsClaims(input),
      sourceReferences: findingsRefs(input),
    };
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
        writerClaims: [],
      };
    }

    return {
      content: this.rewrite(source, input.audience, input.instructions),
      unsupportedClaims: unsupported,
      writerClaims: [],
    };
  }

  private numericClaim(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], finding: VerifiedFinding): ReportClaimDraft {
    const update = input.indicatorUpdates.find((u) => u.indicatorId === finding.indicatorId);
    const evidenceIds = update?.attachedEvidenceIds ?? [];
    const sources = evidenceIds
      .map((evidenceId) => {
        const pkg = input.evidencePackages.find((p) => p.evidenceId === evidenceId);
        const chunk = pkg?.chunks[0];
        return pkg && chunk
          ? { evidenceId: pkg.evidenceId, chunkId: chunk.chunkId, sourceText: chunk.text }
          : undefined;
      })
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
    const label = finding.indicatorName ? `${finding.indicatorCode} (${finding.indicatorName})` : finding.indicatorCode;
    return {
      text: `${label}: ${finding.value}${finding.unit ? ` ${finding.unit}` : ""} reported for the period`,
      type: "NUMERIC",
      proposedSources: sources,
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

  private activityRefs(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): SourceReference[] {
    return input.activities.map((a) => ({
      type: "activity" as const,
      id: a.activityId,
      label: a.activityTitle,
    }));
  }

  private executiveSummary(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const findings = input.verifiedFindings;
    const claims = findings.map((f) => this.numericClaim(input, f));
    const lines = [
      `This report summarises implementation progress during the reporting period.`,
      `${findings.length} indicator finding(s), ${input.activities.length} activity record(s), and ${input.evidencePackages.length} evidence file(s) support the claims below.`,
    ];
    for (const f of findings.slice(0, 5)) {
      lines.push(this.describeFinding(input, f));
    }
    for (const a of input.activities.slice(0, 3)) {
      lines.push(`- Activity: ${a.activityTitle} (${a.activityDate.toISOString().slice(0, 10)})${a.participantsTotal ? `, ${a.participantsTotal} participant(s)` : ""}.`);
    }
    return {
      sectionId: "exec-summary",
      title,
      content: lines.join("\n\n"),
      claims,
      sourceReferences: [
        ...findings.slice(0, 5).map((f) => ({ type: "indicator" as const, id: f.indicatorId, label: f.indicatorName ? `${f.indicatorCode} (${f.indicatorName})` : f.indicatorCode })),
        ...this.activityRefs(input).slice(0, 3),
      ],
    };
  }

  private indicatorProgress(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const findings = input.verifiedFindings;
    const rows = findings.map((f) => {
      const update = input.indicatorUpdates.find((u) => u.indicatorId === f.indicatorId);
      const flags = f.qualityFlags.length > 0 ? ` (flags: ${f.qualityFlags.join(", ")})` : "";
      const source = update?.dataSource ? `; source: ${update.dataSource}` : "";
      const name = f.indicatorName ? ` (${f.indicatorName})` : "";
      const target = f.target ? ` / target ${f.target}${f.unit ? ` ${f.unit}` : ""}` : "";
      const previous = f.comparisonValue !== undefined ? `; previous period: ${f.comparisonValue}${f.unit ? ` ${f.unit}` : ""}` : "";
      return `| ${f.indicatorCode}${name} | ${f.value}${f.unit ? ` ${f.unit}` : ""} | ${target || "no target"}${previous} | ${f.calculationMethod} |${flags}${source} |`;
    });
    const claims = findings.map((f) => this.numericClaim(input, f));
    const content = findings.length === 0
      ? "No verified indicator findings are available for this period."
      : ["| Indicator | Value | Target / Previous | Method |", "| --- | --- | --- | --- |", ...rows].join("\n");
    const notes = input.indicatorUpdates
      .filter((u) => u.comments)
      .map((u) => `- ${u.indicatorCode}: ${u.comments}`);
    const notesText = notes.length > 0 ? `\n\nNotes recorded by M&E:\n${notes.join("\n")}` : "";
    return {
      sectionId: "indicator-progress",
      title,
      content: `${content}${notesText}`,
      claims,
      sourceReferences: [
        ...findings.map((f) => ({ type: "indicator" as const, id: f.indicatorId, label: f.indicatorName ? `${f.indicatorCode} (${f.indicatorName})` : f.indicatorCode })),
        ...this.evidenceRefs(input),
      ],
    };
  }

  private activityNarrative(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const claims: ReportClaimDraft[] = [];
    const refs: SourceReference[] = [];
    const lines: string[] = [];
    for (const a of input.activities) {
      const summary = a.summary.trim() || a.activityTitle;
      lines.push(`- ${a.activityTitle} (${a.activityDate.toISOString().slice(0, 10)})${a.location ? `, ${a.location}` : ""}`);
      lines.push(`  ${summary}`);
      refs.push({ type: "activity", id: a.activityId, label: a.activityTitle });
      const evidenceIds = a.attachedEvidenceIds;
      const sources = evidenceIds
        .map((evidenceId) => {
          const pkg = input.evidencePackages.find((p) => p.evidenceId === evidenceId);
          const chunk = pkg?.chunks[0];
          return pkg && chunk
            ? { evidenceId: pkg.evidenceId, chunkId: chunk.chunkId, sourceText: chunk.text }
            : undefined;
        })
        .filter((s): s is NonNullable<typeof s> => s !== undefined);
      claims.push({
        text: `Activity "${a.activityTitle}" was implemented${a.participantsTotal ? ` with ${a.participantsTotal} participant(s)` : ""}.`,
        type: "QUALITATIVE",
        proposedSources: sources,
      });
      if (evidenceIds.length > 0) {
        lines.push(`  Evidence: ${evidenceIds.map((id) => input.evidencePackages.find((p) => p.evidenceId === id)?.title ?? id).join(", ")}`);
      }
    }
    const content = lines.length === 0 ? "No activity records available for this period." : lines.join("\n");
    return {
      sectionId: "activities",
      title,
      content,
      claims,
      sourceReferences: refs,
    };
  }

  private achievements(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const claims: ReportClaimDraft[] = [];
    const refs: SourceReference[] = [];
    const lines: string[] = [];

    const activityAchievements = input.activities
      .filter((a) => a.achievements.trim())
      .slice(0, 10);
    for (const a of activityAchievements) {
      lines.push(`- ${a.activityTitle}: ${a.achievements}`);
      refs.push({ type: "activity", id: a.activityId, label: a.activityTitle });
    }

    const evidenceUsed = input.evidencePackages
      .filter((p) => p.chunks.length > 0)
      .slice(0, 10);
    for (const p of evidenceUsed) {
      const chunk = p.chunks[0];
      lines.push(`- ${p.title}`);
      refs.push({ type: "evidence", id: p.evidenceId, label: p.title });
      claims.push({
        text: `${p.title} records delivered outputs for the period`,
        type: "QUALITATIVE",
        proposedSources: chunk ? [{ evidenceId: p.evidenceId, chunkId: chunk.chunkId, sourceText: chunk.text }] : [],
      });
      if (chunk) {
        lines.push(`  ${chunk.text.slice(0, 200)}`);
      }
    }

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
    const lines: string[] = [];
    const refs: SourceReference[] = [];
    const claims: ReportClaimDraft[] = [];
    for (const a of input.activities) {
      if (!a.challenges.trim()) continue;
      lines.push(`- ${a.activityTitle}: ${a.challenges}`);
      refs.push({ type: "activity", id: a.activityId, label: a.activityTitle });
      const sources = a.attachedEvidenceIds
        .map((evidenceId) => {
          const pkg = input.evidencePackages.find((p) => p.evidenceId === evidenceId);
          const chunk = pkg?.chunks[0];
          return pkg && chunk
            ? { evidenceId: pkg.evidenceId, chunkId: chunk.chunkId, sourceText: chunk.text }
            : undefined;
        })
        .filter((s): s is NonNullable<typeof s> => s !== undefined);
      claims.push({
        text: `Challenge recorded for "${a.activityTitle}": ${a.challenges}`,
        type: "QUALITATIVE",
        proposedSources: sources,
      });
    }
    const content = lines.length === 0
      ? "No challenges were recorded in activity updates for this period."
      : lines.join("\n");
    return {
      sectionId: "challenges",
      title,
      content,
      claims,
      sourceReferences: refs,
    };
  }

  private lessons(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const lines: string[] = [];
    const refs: SourceReference[] = [];
    const claims: ReportClaimDraft[] = [];
    for (const a of input.activities) {
      if (!a.lessonsLearned.trim()) continue;
      lines.push(`- ${a.activityTitle}: ${a.lessonsLearned}`);
      refs.push({ type: "activity", id: a.activityId, label: a.activityTitle });
      const sources = a.attachedEvidenceIds
        .map((evidenceId) => {
          const pkg = input.evidencePackages.find((p) => p.evidenceId === evidenceId);
          const chunk = pkg?.chunks[0];
          return pkg && chunk
            ? { evidenceId: pkg.evidenceId, chunkId: chunk.chunkId, sourceText: chunk.text }
            : undefined;
        })
        .filter((s): s is NonNullable<typeof s> => s !== undefined);
      claims.push({
        text: `Lesson recorded for "${a.activityTitle}": ${a.lessonsLearned}`,
        type: "QUALITATIVE",
        proposedSources: sources,
      });
    }
    const content = lines.length === 0
      ? "No lessons learned were recorded in activity updates for this period."
      : lines.join("\n");
    return {
      sectionId: "lessons",
      title,
      content,
      claims,
      sourceReferences: refs,
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
      const activityLines = input.activities.slice(0, 5).map((a) => `- ${a.activityTitle}: ${a.summary || a.achievements}`);
      const body = activityLines.length > 0 ? activityLines.join("\n") : `[Drafted from verified findings, report plan, and evidence. No findings available this period.]`;
      return `Activity records for the period:\n${body}`;
    }
    return findings.slice(0, 5).map((f) => this.describeFinding(input, f)).join("\n\n");
  }

  private describeFinding(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], finding: VerifiedFinding): string {
    const flags = finding.qualityFlags.length > 0 ? ` (${finding.qualityFlags.join(", ")})` : "";
    const update = input.indicatorUpdates.find((u) => u.indicatorId === finding.indicatorId);
    const source = update?.dataSource ? ` Source: ${update.dataSource}.` : "";
    const label = finding.indicatorName ? `${finding.indicatorCode} (${finding.indicatorName})` : finding.indicatorCode;
    const target = finding.target ? ` against a target of ${finding.target}${finding.unit ? ` ${finding.unit}` : ""}` : "";
    const previous = finding.comparisonValue !== undefined
      ? `, compared to ${finding.comparisonValue}${finding.unit ? ` ${finding.unit}` : ""} in the previous period`
      : "";
    const perf = finding.performanceEvaluation && finding.performanceEvaluation.type !== "NEUTRAL"
      ? ` Performance: ${finding.performanceEvaluation.type.toLowerCase()} (${finding.performanceEvaluation.detail}).`
      : "";
    return `${label}: ${finding.value}${finding.unit ? ` ${finding.unit}` : ""} recorded via ${finding.calculationMethod}${target}${previous}${perf}${flags}.${source}`;
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
    // Phase 6 invariant: a rewrite must never silently remove caveats. The
    // unsupported-claim markers [Needs verification] / [Needs source
    // verification] are preserved verbatim so the underlying checklist item
    // can still be resolved in the UI; they are only removable via the
    // explicit checklist resolution workflow.
    let text = content.trim();
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

function findingsClaims(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): ReportClaimDraft[] {
  return input.verifiedFindings.slice(0, 3).map((f) => ({
    text: `${f.indicatorName ? `${f.indicatorCode} (${f.indicatorName})` : f.indicatorCode}: ${f.value}${f.unit ? ` ${f.unit}` : ""} reported for the period`,
    type: "NUMERIC" as const,
    proposedSources: [],
  }));
}

function findingsRefs(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): SourceReference[] {
  return input.verifiedFindings.slice(0, 3).map((f) => ({
    type: "indicator" as const,
    id: f.indicatorId,
    label: f.indicatorName ? `${f.indicatorCode} (${f.indicatorName})` : f.indicatorCode,
  }));
}
