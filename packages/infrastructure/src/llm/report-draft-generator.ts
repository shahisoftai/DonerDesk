import type { IReportDraftGenerator, GeneratedSection, GeneratedSectionResult, ReportClaimDraft, ActivityGenerationContext } from "@donordesk/application";
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
    if (titleLower.includes("methodolog") || titleLower.includes("data quality")) {
      return this.methodologyNote(input, planSection.title);
    }
    if (titleLower.includes("indicator")) {
      return this.indicatorProgress(input, planSection.title);
    }
    if (titleLower.includes("activit")) {
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
    if (titleLower.includes("next period") || titleLower.includes("work plan")) {
      return this.nextPeriodPlan(input, planSection.title);
    }
    if (titleLower.includes("voice") || titleLower.includes("testimonial") || titleLower.includes("quote")) {
      return this.beneficiaryVoice(input, planSection.title);
    }
    if (titleLower.includes("financial") || titleLower.includes("budget")) {
      return this.financialSummary(input, planSection.title);
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
    const claims = findings
      .filter((f) => !f.qualityFlags.includes("MISSING_DENOMINATOR"))
      .slice(0, 5)
      .map((f) => this.numericClaim(input, f));
    const project = input.reportContext?.project;
    const period = input.reportContext?.period;

    const inPeriodActivities = this.activitiesInPeriod(input).inPeriod;

    // Paragraph 1 — context. Every figure is a verbatim count of system records.
    const p1Parts: string[] = [];
    if (period) {
      p1Parts.push(`This report covers implementation from ${period.startDate.slice(0, 10)} to ${period.endDate.slice(0, 10)}`);
    } else {
      p1Parts.push(`This report covers the current reporting period`);
    }
    if (project) {
      p1Parts.push(`for the ${project.title} project (${project.sector}, ${project.country}), implemented by ${project.implementingOrganization}${project.donorName ? ` with funding from ${project.donorName}` : ""}`);
    }
    p1Parts.push(`. During the period the project recorded ${inPeriodActivities.length} activity record(s), ${findings.length} verified indicator result(s), and ${input.evidencePackages.length} supporting evidence file(s).`);
    const p1 = p1Parts.join("");

    // Paragraph 2 — performance. Values are quoted verbatim; percentages are
    // never computed in prose (they live only in the Annex A table).
    const positives = findings.filter((f) => f.performanceEvaluation?.type === "POSITIVE");
    const negatives = findings.filter((f) => f.performanceEvaluation?.type === "NEGATIVE");
    const notCalculable = findings.filter((f) => f.qualityFlags.includes("MISSING_DENOMINATOR"));
    const p2Parts: string[] = [];
    const highlight = (f: VerifiedFinding): string => {
      const label = f.indicatorName ? `${f.indicatorCode} (${f.indicatorName})` : f.indicatorCode;
      const previous = f.comparisonValue !== undefined
        ? `, compared to ${f.comparisonValue}${f.unit ? ` ${f.unit}` : ""} in the previous period`
        : "";
      const target = f.target ? ` against a target of ${f.target}${f.unit ? ` ${f.unit}` : ""}` : "";
      return `${label} recorded ${f.value}${f.unit ? ` ${f.unit}` : ""}${target}${previous}.`;
    };
    if (positives.length > 0) {
      p2Parts.push(`The strongest verified results were: ${positives.slice(0, 2).map(highlight).join(" ")}`);
    }
    if (negatives.length > 0) {
      p2Parts.push(`Results below expectation: ${negatives.slice(0, 2).map(highlight).join(" ")}`);
    }
    if (notCalculable.length > 0) {
      p2Parts.push(`${notCalculable.length} indicator result(s) could not be calculated because denominators were unavailable; these are listed with the data-quality notes in Annex A.`);
    }
    if (p2Parts.length === 0) {
      p2Parts.push("No evaluative indicator performance was available for this period; results are reported descriptively in Annex A.");
    }
    const p2 = p2Parts.join(" ");

    // Paragraph 3 — delivery, challenges, outlook.
    const p3Parts: string[] = [];
    // Quote recorded participant counts per activity verbatim. A computed
    // total is a number that exists in no record, which the writer contract
    // forbids and the report-level numeric consistency check rejects.
    const withParticipants = inPeriodActivities.filter((a) => (a.participantsTotal ?? 0) > 0).slice(0, 3);
    if (withParticipants.length > 0) {
      p3Parts.push(
        `Recorded participation included ${withParticipants.map((a) => `${a.participantsTotal} participant(s) in "${a.activityTitle}"`).join(", ")}.`,
      );
    }
    const challenge = input.activities.find((a) => a.challenges.trim());
    if (challenge) {
      p3Parts.push(`A key challenge recorded was: ${challenge.challenges.trim().replace(/\s+/g, " ").slice(0, 240)}`);
    } else {
      p3Parts.push("No material challenges were recorded in activity updates for this period.");
    }
    const story = input.reportContext?.storyContext;
    const storyLesson = story?.lessons?.trim() ?? story?.achievements?.trim();
    if (storyLesson) {
      p3Parts.push(`Context recorded by the reporting officer: ${storyLesson.trim().slice(0, 240)}`);
    }
    p3Parts.push("Detailed results are presented in Progress Against Indicators and Annex A; priorities for the next period are set out in the work plan section.");
    const p3 = p3Parts.join(" ");

    return {
      sectionId: "exec-summary",
      title,
      content: [p1, p2, p3].join("\n\n"),
      claims,
      sourceReferences: [
        ...findings.slice(0, 5).map((f) => ({ type: "indicator" as const, id: f.indicatorId, label: f.indicatorName ? `${f.indicatorCode} (${f.indicatorName})` : f.indicatorCode })),
        ...this.activityRefs(input).slice(0, 3),
      ],
    };
  }

  private indicatorProgress(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const findings = input.verifiedFindings;
    const claims = findings
      .filter((f) => !f.qualityFlags.includes("MISSING_DENOMINATOR"))
      .map((f) => this.numericClaim(input, f));

    if (findings.length === 0) {
      return {
        sectionId: "indicator-progress",
        title,
        content: "No verified indicator findings are available for this period.",
        claims,
        sourceReferences: [],
      };
    }

    // Narrative highlights instead of a second full table: the complete
    // indicator table lives once, in Annex A. Prose quotes values verbatim.
    const positives = findings.filter((f) => f.performanceEvaluation?.type === "POSITIVE");
    const negatives = findings.filter((f) => f.performanceEvaluation?.type === "NEGATIVE");
    const notCalculable = findings.filter((f) => f.qualityFlags.includes("MISSING_DENOMINATOR"));

    const lines: string[] = [
      `Of the ${findings.length} indicator result(s) verified for this period, ${positives.length} performed favourably against their direction of performance, ${negatives.length} performed unfavourably, and ${notCalculable.length} could not be calculated (denominator unavailable).`,
      "",
      "The following results moved most against their targets or previous period:",
      "",
    ];
    const movers = [...positives, ...negatives].slice(0, 6);
    if (movers.length === 0) movers.push(...findings.slice(0, 6));
    lines.push("| Code | Indicator | This period | Previous | Direction |", "| --- | --- | --- | --- | --- |");
    for (const f of movers) {
      const name = f.indicatorName ?? "";
      const value = f.qualityFlags.includes("MISSING_DENOMINATOR") ? "Not calculable" : f.value;
      const previous = f.comparisonValue ?? "—";
      const direction = f.performanceEvaluation?.type === "POSITIVE" ? "Favourable" : f.performanceEvaluation?.type === "NEGATIVE" ? "Unfavourable" : "Descriptive";
      lines.push(`| ${f.indicatorCode} | ${name} | ${value}${f.unit ? ` ${f.unit}` : ""} | ${previous} | ${direction} |`);
    }
    lines.push("", "The complete indicator performance table, including baselines, targets, achievement rates, and data sources, is provided in Annex A.");

    const notes = input.indicatorUpdates
      .filter((u) => u.comments)
      .map((u) => `- ${u.indicatorCode}: ${u.comments}`);
    const notesText = notes.length > 0 ? `\n\nNotes recorded by M&E:\n${notes.join("\n")}` : "";
    return {
      sectionId: "indicator-progress",
      title,
      content: `${lines.join("\n")}${notesText}`,
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
    const { inPeriod, outOfPeriod } = this.activitiesInPeriod(input);
    const describe = (a: ActivityGenerationContext): void => {
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
    };
    for (const a of inPeriod) describe(a);
    // Out-of-window records are context, never passed off as this period's
    // delivery (the EERP Q2 draft mixed February/March activities into a Q2
    // narrative; the cross-section lint now warns about such dates too).
    if (outOfPeriod.length > 0) {
      lines.push("", `Context — records dated outside this reporting period (${outOfPeriod.length}):`);
      for (const a of outOfPeriod) {
        lines.push(`- ${a.activityTitle} (${a.activityDate.toISOString().slice(0, 10)})${a.location ? `, ${a.location}` : ""}`);
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

  private nextPeriodPlan(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const planned = input.activities.filter((a) => a.nextSteps.trim());
    return {
      sectionId: "next-period-plan",
      title,
      content: planned.length === 0
        ? "No approved next-period actions were recorded in activity updates for this reporting period. Add the approved work plan before finalization."
        : planned.map((a) => `- ${a.activityTitle}: ${a.nextSteps}`).join("\n"),
      claims: [],
      sourceReferences: planned.map((a) => ({ type: "activity" as const, id: a.activityId, label: a.activityTitle })),
    };
  }

  private annexList(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const refs = this.evidenceRefs(input);
    const findings = input.verifiedFindings;

    // Annex A — the single full indicator performance table (v2): baseline,
    // target, current, previous, achievement vs target, RAG, and the real
    // per-indicator data source. Achievement % is presentation arithmetic on
    // verified decimals and lives only inside table cells (the assurance
    // extractor skips table rows; prose never carries computed percentages).
    const tableLines: string[] = [];
    if (findings.length > 0) {
      tableLines.push("### A.1 Indicator performance table", "");
      tableLines.push(
        "| Code | Indicator | Unit | Baseline | Target | This period | Previous | % of target | RAG | Data source |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      );
      for (const f of findings) {
        const update = input.indicatorUpdates.find((u) => u.indicatorId === f.indicatorId);
        const notCalculable = f.qualityFlags.includes("MISSING_DENOMINATOR");
        const display = (v: string | undefined): string => (v === undefined || v === "" ? "—" : `${v}${f.unit ? ` ${f.unit}` : ""}`);
        tableLines.push(
          `| ${f.indicatorCode} | ${f.indicatorName ?? ""} | ${f.unit ?? "—"} | ${display(f.baseline)} | ${display(f.target)} | ${
            notCalculable ? "Not calculable" : display(f.value)
          } | ${f.comparisonValue !== undefined ? display(f.comparisonValue) : "—"} | ${notCalculable ? "—" : this.pctOfTarget(f)} | ${this.ragFor(f)} | ${
            update?.dataSource ?? "Project records"
          } |`,
        );
      }
      tableLines.push("");
    }

    const qualityNotes = this.dataQualityNote(input);

    const evidenceLines: string[] = [];
    if (refs.length > 0) {
      evidenceLines.push("### A.2 Evidence pack", "");
      evidenceLines.push(`The evidence pack contains ${refs.length} file(s):`);
      for (const r of refs.slice(0, 20)) {
        evidenceLines.push(`- ${r.label}`);
      }
      if (refs.length > 20) evidenceLines.push(`- …and ${refs.length - 20} more (see the exported evidence pack index)`);
    }

    const blocks = [tableLines.join("\n"), qualityNotes, evidenceLines.join("\n")].filter((b) => b.trim().length > 0);

    return {
      sectionId: "annex-list",
      title,
      content: blocks.length > 0 ? blocks.join("\n\n") : "No indicator data or evidence is attached yet.",
      claims: refs.length > 0 ? [this.evidenceClaim(input, 0)].filter((c) => c.text) : [],
      sourceReferences: refs,
    };
  }

  /**
   * Aggregated data-quality note (Annex A block). Quality caveats are stated
   * once here instead of being repeated after every indicator sentence.
   */
  private dataQualityNote(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): string {
    const findings = input.verifiedFindings;
    if (findings.length === 0) return "";
    const notCalculable = findings.filter((f) => f.qualityFlags.includes("MISSING_DENOMINATOR"));
    const partial = findings.filter((f) => f.qualityFlags.includes("LOW_COVERAGE"));
    const stale = findings.filter((f) => f.qualityFlags.includes("STALE"));
    const missingDisagg = findings.filter((f) => f.qualityFlags.includes("MISSING_DISAGGREGATION"));
    if (notCalculable.length === 0 && partial.length === 0 && stale.length === 0 && missingDisagg.length === 0) return "";
    const lines: string[] = ["### A.3 Data quality notes", ""];
    const codeList = (fs: typeof findings): string => fs.map((f) => f.indicatorCode).join(", ");
    if (notCalculable.length > 0) {
      lines.push(`- Results could not be calculated because denominators were unavailable: ${codeList(notCalculable)}. Record the denominator data to enable these calculations.`);
    }
    if (partial.length > 0) {
      lines.push(`- Figures are based on partial records: ${codeList(partial)}.`);
    }
    if (stale.length > 0) {
      lines.push(`- Underlying records predate the reporting period: ${codeList(stale)}.`);
    }
    if (missingDisagg.length > 0) {
      lines.push(`- Gender/disaggregated breakdowns were not recorded for: ${codeList(missingDisagg)}.`);
    }
    return lines.join("\n");
  }

  private methodologyNote(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const period = input.reportContext?.period;
    const project = input.reportContext?.project;
    const sources = [...new Set(input.indicatorUpdates.map((u) => u.dataSource).filter((s): s is string => Boolean(s && s.trim())))];
    const lines: string[] = [];
    lines.push(
      period
        ? `This report covers the reporting period ${period.startDate.slice(0, 10)} to ${period.endDate.slice(0, 10)} (report type: ${period.reportType}).`
        : `This report covers the current reporting period.`,
    );
    if (project) {
      lines.push(`All indicator figures were computed by the platform's deterministic indicator analyst directly from the indicator updates recorded for this period${project.projectCode ? ` (project ${project.projectCode})` : ""}. Narrative text quotes these verified values verbatim; the narrator never computes, aggregates, or estimates figures.`);
    } else {
      lines.push("All indicator figures were computed by the platform's deterministic indicator analyst directly from the indicator updates recorded for this period. Narrative text quotes these verified values verbatim.");
    }
    if (sources.length > 0) {
      lines.push("", "**Data sources recorded on indicator updates**", "");
      for (const s of sources) lines.push(`- ${s}`);
    }
    lines.push("", `Evidence base: ${input.evidencePackages.length} file(s) attached to this period's indicator updates and activity records; cited extracts are verified against the stored source hash.`);
    const quality = this.dataQualityNote(input);
    if (quality) {
      lines.push("", quality.replace(/^### A\.3 Data quality notes\n\n?/, "").trim());
    }
    return {
      sectionId: "methodology-note",
      title,
      content: lines.join("\n"),
      claims: [],
      sourceReferences: this.evidenceRefs(input).slice(0, 5),
    };
  }

  /**
   * Beneficiary voice — only VERBATIM quoted sentences (>= 40 chars) found in
   * attached evidence chunks are quoted, each with its evidence citation.
   * Nothing is ever invented; when no quotations exist the section says so.
   */
  private beneficiaryVoice(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const quotes: Array<{ text: string; evidenceId: string; chunkId: string; title: string }> = [];
    for (const pkg of input.evidencePackages) {
      for (const chunk of pkg.chunks) {
        const re = /"([^"\n]{40,320})"/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(chunk.text)) !== null) {
          const q = (m[1] ?? "").trim();
          if (!q || /https?:\/\//i.test(q)) continue;
          if (quotes.some((existing) => existing.text === q)) continue;
          quotes.push({ text: q, evidenceId: pkg.evidenceId, chunkId: chunk.chunkId, title: pkg.title });
          if (quotes.length >= 3) break;
        }
        if (quotes.length >= 3) break;
      }
      if (quotes.length >= 3) break;
    }
    if (quotes.length === 0) {
      return {
        sectionId: "beneficiary-voice",
        title,
        content: "No beneficiary testimonies were recorded in the evidence attached to this period. Add interview notes or story documents to the evidence library and link them to the period to include beneficiary voices here.",
        claims: [],
        sourceReferences: [],
      };
    }
    const lines: string[] = ["The following accounts are quoted verbatim from evidence documents collected during the period:", ""];
    const claims: ReportClaimDraft[] = [];
    for (const q of quotes) {
      lines.push(`> "${q.text}"`, `> — recorded in ${q.title} (evidence)`, "");
      claims.push({
        text: `Testimony quoted from ${q.title}`,
        type: "QUALITATIVE",
        proposedSources: [{ evidenceId: q.evidenceId, chunkId: q.chunkId, sourceText: q.text }],
      });
    }
    return {
      sectionId: "beneficiary-voice",
      title,
      content: lines.join("\n").trim(),
      claims,
      sourceReferences: quotes.map((q) => ({ type: "evidence" as const, id: q.evidenceId, label: q.title })),
    };
  }

  private financialSummary(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): GeneratedSection {
    const project = input.reportContext?.project;
    const lines: string[] = [];
    if (project?.budgetAmount !== undefined && project.budgetAmount !== null) {
      lines.push(`The approved project budget is ${project.budgetAmount.toLocaleString("en-US")}${project.budgetCurrency ? ` ${project.budgetCurrency}` : ""} (project documents).`);
    } else {
      lines.push("The project budget was not recorded in the system.");
    }
    lines.push("An expenditure breakdown for this reporting period was not recorded in the system. Attach the interim financial report to the evidence library and record expenditure against budget lines before this section can carry verified financial figures.");
    if (project?.reportingFrequency) {
      lines.push(`Financial reporting frequency: ${project.reportingFrequency}.`);
    }
    return {
      sectionId: "financial-summary",
      title,
      content: lines.join("\n\n"),
      claims: [],
      sourceReferences: [],
    };
  }

  /** Activities split into in-period and out-of-window (context) records. */
  private activitiesInPeriod(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): { inPeriod: ActivityGenerationContext[]; outOfPeriod: ActivityGenerationContext[] } {
    const period = input.reportContext?.period;
    if (!period) return { inPeriod: input.activities, outOfPeriod: [] };
    const start = Date.parse(period.startDate);
    const end = Date.parse(period.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { inPeriod: input.activities, outOfPeriod: [] };
    const inPeriod: ActivityGenerationContext[] = [];
    const outOfPeriod: ActivityGenerationContext[] = [];
    for (const a of input.activities) {
      const t = a.activityDate instanceof Date ? a.activityDate.getTime() : Date.parse(String(a.activityDate));
      if (Number.isFinite(t) && t >= start && t <= end) inPeriod.push(a);
      else outOfPeriod.push(a);
    }
    return { inPeriod, outOfPeriod };
  }

  /** Presentation-only achievement vs target; returns "—" when not derivable. */
  private pctOfTarget(finding: VerifiedFinding): string {
    if (finding.qualityFlags.includes("MISSING_DENOMINATOR")) return "—";
    const value = Number.parseFloat((finding.value ?? "").replace(/,/g, ""));
    const target = Number.parseFloat((finding.target ?? "").replace(/,/g, ""));
    if (!Number.isFinite(value) || !Number.isFinite(target) || target === 0) return "—";
    return `${Math.round((value / target) * 100)}%`;
  }

  /** Deterministic RAG from the gated performance evaluation + quality flags. */
  private ragFor(finding: VerifiedFinding): string {
    if (finding.qualityFlags.includes("MISSING_DENOMINATOR")) return "GREY";
    const type = finding.performanceEvaluation?.type;
    if (type === "POSITIVE") return finding.qualityFlags.some((f) => f === "LOW_COVERAGE" || f === "STALE" || f === "NEEDS_REVIEW") ? "AMBER" : "GREEN";
    if (type === "NEGATIVE") return "RED";
    if (type === "NEUTRAL") return "AMBER";
    return "—";
  }

  private descriptiveNarrative(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], title: string): string {
    const findings = input.verifiedFindings;
    const story = this.storyContextBlock(input);
    let body: string;
    if (findings.length === 0) {
      const activityLines = input.activities.slice(0, 5).map((a) => `- ${a.activityTitle}: ${a.summary || a.achievements}`);
      body = activityLines.length > 0 ? `Activity records for the period:\n${activityLines.join("\n")}` : `No verified findings or activity records were available for this period.`;
    } else {
      body = findings.slice(0, 5).map((f) => this.describeFinding(input, f)).join("\n\n");
    }
    return story ? `${body}\n\n${story}` : body;
  }

  private storyContextBlock(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): string {
    const story = input.reportContext?.storyContext;
    if (!story) return "";
    const labels: Record<string, string> = {
      achievements: "What went well",
      challenges: "Challenges faced",
      varianceExplanations: "Why targets were over/under achieved",
      adaptations: "What changed or was adapted",
      lessons: "Lessons and observations",
    };
    const rows: string[] = [];
    for (const [key, label] of Object.entries(labels)) {
      const value = story[key as keyof typeof story];
      if (value && value.trim()) rows.push(`- ${label}: ${value.trim()}`);
    }
    return rows.length > 0 ? `Context recorded by the reporting officer:\n${rows.join("\n")}` : "";
  }

  /**
   * P0-2 — Converts internal quality-flag codes into donor-friendly caveat
   * language so engineering/debug strings never leak into a user-facing report.
   */
  private cleanQualityCaveats(flags: string[]): string {
    const map: Record<string, string> = {
      MISSING_DISAGGREGATION: "disaggregated data was not recorded",
      LOW_COVERAGE: "the figures are based on partial records",
      STALE: "the underlying records predate the reporting period",
      UNIT_MISMATCH: "units were inconsistent across the source records",
      NEEDS_REVIEW: "the figure requires verification before finalisation",
      MISSING_DENOMINATOR: "the denominator could not be established",
    };
    const clean = flags
      .map((f) => map[f])
      .filter((t): t is string => Boolean(t));
    return clean.length > 0 ? clean.join("; ") : "";
  }

  private describeFinding(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], finding: VerifiedFinding): string {
    const update = input.indicatorUpdates.find((u) => u.indicatorId === finding.indicatorId);
    const source = update?.dataSource ? ` Source: ${update.dataSource}.` : "";
    const label = finding.indicatorName ? `${finding.indicatorCode} (${finding.indicatorName})` : finding.indicatorCode;
    const target = finding.target ? ` against a target of ${finding.target}${finding.unit ? ` ${finding.unit}` : ""}` : "";
    const previous = finding.comparisonValue !== undefined
      ? `, compared to ${finding.comparisonValue}${finding.unit ? ` ${finding.unit}` : ""} in the previous period`
      : "";
    const perf = finding.performanceEvaluation && finding.performanceEvaluation.type !== "NEUTRAL"
      ? ` Performance: ${finding.performanceEvaluation.type.toLowerCase()}${finding.performanceEvaluation.detail ? ` (${finding.performanceEvaluation.detail})` : ""}.`
      : "";
    const caveat = this.cleanQualityCaveats(finding.qualityFlags);
    if (finding.qualityFlags.includes("MISSING_DENOMINATOR")) {
      return `${label}: the result could not be calculated because the denominator was unavailable.${source}`;
    }
    const caveatsClause = caveat ? ` Note: ${caveat}.` : "";
    return `${label}: ${finding.value}${finding.unit ? ` ${finding.unit}` : ""} recorded for the period${target}${previous}${perf}${caveatsClause}${source}`;
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
