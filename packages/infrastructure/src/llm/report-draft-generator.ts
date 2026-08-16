import type { IReportDraftGenerator } from "@donordesk/application";
import type { SourceReference } from "@donordesk/domain";
import { calculateReadiness } from "@donordesk/domain";

export class StubReportDraftGenerator implements IReportDraftGenerator {
  async generateDraft(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): ReturnType<IReportDraftGenerator["generateDraft"]> {
    const sections: Array<{
      sectionId: string;
      title: string;
      content: string;
      sourceReferences: SourceReference[];
      unsupportedClaims: string[];
    }> = [];

    const totalActivities = input.activities.length;
    const totalBeneficiaries = input.activities.reduce((sum, a) => sum + (a.participants ?? 0), 0);

    for (const sec of input.templateSections.length > 0 ? input.templateSections : this.fallbackSections()) {
      const refs: SourceReference[] = [];
      const unsupported: string[] = [];

      switch (sec.title.toLowerCase()) {
        case "executive summary": {
          const firstActivity = input.activities[0];
          const refsForExec: SourceReference[] = firstActivity
            ? [{ type: "activity", id: firstActivity.id, label: `Activity ${firstActivity.title}` }]
            : [];
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: this.buildExecSummary(input, totalActivities, totalBeneficiaries),
            sourceReferences: refsForExec,
            unsupportedClaims: [],
          });
          break;
        }
        case "project progress": {
          const refsForProgress: SourceReference[] = input.activities.map((a) => ({ type: "activity" as const, id: a.id, label: a.title }));
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: this.buildProjectProgress(input),
            sourceReferences: refsForProgress,
            unsupportedClaims: [],
          });
          break;
        }
        case "indicator progress": {
          const indicatorRefs: SourceReference[] = input.indicatorSummary.map((i) => ({ type: "indicator" as const, id: i.code, label: `${i.code} ${i.name}` }));
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: this.buildIndicatorTable(input),
            sourceReferences: indicatorRefs,
            unsupportedClaims: [],
          });
          break;
        }
        case "achievements": {
          const achRefs: SourceReference[] = input.activities.map((a) => ({ type: "activity" as const, id: a.id, label: a.title }));
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: this.buildAchievements(input),
            sourceReferences: achRefs,
            unsupportedClaims: [],
          });
          break;
        }
        case "challenges": {
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: this.buildChallenges(input),
            sourceReferences: [],
            unsupportedClaims: input.activities.length === 0 ? ["No challenges reported"] : [],
          });
          break;
        }
        case "lessons learned": {
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: this.buildLessons(input),
            sourceReferences: [],
            unsupportedClaims: input.activities.length === 0 ? ["No lessons learned recorded"] : [],
          });
          break;
        }
        case "risks & mitigation": {
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: "Top risks and mitigation measures will be added once flagged in the checklist. [Needs verification]",
            sourceReferences: [],
            unsupportedClaims: ["Top risks not yet identified in this period"],
          });
          break;
        }
        case "beneficiary reach": {
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: this.buildBeneficiaryReach(input, totalBeneficiaries),
            sourceReferences: input.activities.map((a) => ({ type: "activity" as const, id: a.id, label: a.title })),
            unsupportedClaims: [],
          });
          break;
        }
        case "annex list": {
          const annexRefs: SourceReference[] = [];
          for (const arr of input.evidenceByActivity.values()) {
            for (const e of arr) annexRefs.push({ type: "evidence" as const, id: e.id, label: e.title });
          }
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: "Refer to the evidence pack attached to this report for the full annex list.",
            sourceReferences: annexRefs,
            unsupportedClaims: annexRefs.length === 0 ? ["No evidence attached yet"] : [],
          });
          break;
        }
        default: {
          sections.push({
            sectionId: sec.id,
            title: sec.title,
            content: `[Section content will be drafted from logframe, indicators, activities, and evidence.]`,
            sourceReferences: refs,
            unsupportedClaims: unsupported,
          });
        }
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

  private shorten(content: string, audience: "DONOR" | "INTERNAL" | "GENERAL"): string {
    // Heuristic compression: drop non-informative filler, keep the first
    // sentence of each paragraph and every factual line (bullets / tables).
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

  private fallbackSections() {
    return [
      { id: "fb-exec", title: "Executive Summary", description: "", inputType: "NARRATIVE", required: true, evidenceNeeded: "" },
      { id: "fb-progress", title: "Project Progress", description: "", inputType: "NARRATIVE", required: true, evidenceNeeded: "" },
      { id: "fb-indicators", title: "Indicator Progress", description: "", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: "" },
      { id: "fb-achievements", title: "Achievements", description: "", inputType: "NARRATIVE", required: true, evidenceNeeded: "" },
      { id: "fb-challenges", title: "Challenges", description: "", inputType: "NARRATIVE", required: true, evidenceNeeded: "" },
      { id: "fb-lessons", title: "Lessons Learned", description: "", inputType: "NARRATIVE", required: false, evidenceNeeded: "" },
      { id: "fb-risks", title: "Risks & Mitigation", description: "", inputType: "NARRATIVE", required: false, evidenceNeeded: "" },
      { id: "fb-reach", title: "Beneficiary Reach", description: "", inputType: "TABLE", required: true, evidenceNeeded: "" },
      { id: "fb-annex", title: "Annex List", description: "", inputType: "ANNEX", required: true, evidenceNeeded: "" },
    ];
  }

  private buildExecSummary(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], totalActivities: number, totalBeneficiaries: number): string {
    return [
      `This ${input.reportType.toLowerCase().replace(/_/g, " ")} report summarises the implementation progress of ${input.projectName} funded by ${input.donorName}.`,
      `During the reporting period, ${totalActivities} activities were completed, reaching ${totalBeneficiaries} beneficiaries.`,
      `Indicator achievements and evidence attached support the claims below.`,
    ].join(" ");
  }

  private buildProjectProgress(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): string {
    if (input.activities.length === 0) return "No activities have been recorded yet for this reporting period. [Needs verification]";
    const lines = input.activities.map((a, i) => {
      const evCount = input.evidenceByActivity.get(a.id)?.length ?? 0;
      return `${i + 1}. **${a.title}** (${a.date.slice(0, 10)}, ${a.location ?? "location not specified"}, ${a.participants ?? 0} participants) — ${evCount} evidence files attached.`;
    });
    return ["The following activities were completed during the reporting period:", ...lines].join("\n");
  }

  private buildIndicatorTable(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): string {
    if (input.indicatorSummary.length === 0) return "No indicators have been defined for this project yet.";
    const rows = input.indicatorSummary.map(
      (i) => `| ${i.code} | ${i.name} | ${i.baseline} | ${i.target} | ${i.periodAchievement}${i.unit ? ` ${i.unit}` : ""} | ${i.cumulativeAchievement}${i.unit ? ` ${i.unit}` : ""} |`,
    );
    return ["| Code | Indicator | Baseline | Target | Period Achievement | Cumulative |", "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n");
  }

  private buildAchievements(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): string {
    if (input.activities.length === 0) return "No achievements have been recorded. [Needs verification]";
    return input.activities.map((a) => `- ${a.achievements || a.summary}`).join("\n");
  }

  private buildChallenges(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): string {
    const items = input.activities.map((a) => a.challenges).filter(Boolean);
    if (items.length === 0) return "No challenges recorded for this period.";
    return items.map((c) => `- ${c}`).join("\n");
  }

  private buildLessons(input: Parameters<IReportDraftGenerator["generateDraft"]>[0]): string {
    const items = input.activities.map((a) => a.lessonsLearned).filter(Boolean);
    if (items.length === 0) return "No lessons learned recorded for this period.";
    return items.map((c) => `- ${c}`).join("\n");
  }

  private buildBeneficiaryReach(input: Parameters<IReportDraftGenerator["generateDraft"]>[0], totalBeneficiaries: number): string {
    return `Total beneficiaries reached: ${totalBeneficiaries}. Disaggregated breakdowns are recorded in the linked activity updates and attendance sheets.`;
  }
}
