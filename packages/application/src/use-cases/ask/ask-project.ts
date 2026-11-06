import {
  DomainError, NOT_FOUND_SENTENCE, Permissions, activityCandidates, buildAskPrompt, evidenceCandidates, groundAnswer, indicatorCandidates, projectCandidate,
  readableConfidentialityLevels, redactForLlm, selectSources, toPlainDate,
  type AskAnswer, type AskCandidate, type Result, type Role,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { ILLMProvider } from "../../ports/infrastructure.js";
import type { ILlmUsageRepository } from "../../ports/billing.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";

export const ASK_OPERATION = "ASK_DONORDESK";
export const ASK_MAX_QUESTION = 500;
const HOURLY_LIMIT = 60;
const DAILY_LIMIT = 400;

export type AskOutcome =
  | { available: false; reason: string }
  | {
      available: true;
      status: AskAnswer["status"];
      answer: string[];
      sentences: AskAnswer["sentences"];
      missing: string[];
      dropped: AskAnswer["dropped"];
      /** What was looked at, so the person can see how much the answer rests on. */
      looked: { indicators: number; activities: number; evidence: number };
    };

/**
 * Ask DonorDesk: a question put to one project's own records (Phase 33.9). It is off until an administrator opts in. The records the
 * asker may see are cut into numbered sources, the most relevant go to the model (personal details redacted going out), and the
 * reply is checked here: a sentence stays only if it names a real source and its figures are in that source. Evidence the asker
 * may not open is never read. Each question is audited by its length and the sources used, not by its text.
 */
export class AskProjectHandler {
  constructor(
    private readonly orgs: IOrganizationRepository,
    private readonly projects: IProjectRepository,
    private readonly visible: VisibleProjects,
    private readonly sheets: GetProjectDataSheetHandler,
    private readonly activities: IActivityUpdateRepository,
    private readonly evidence: IEvidenceRepository,
    private readonly usage: ILlmUsageRepository,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly llmFor: (tenantId: string) => Promise<ILLMProvider | null>,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, rawQuestion: string): Promise<Result<AskOutcome, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.view")) return { ok: false, error: DomainError.forbidden("You cannot ask about this project") };
    const question = rawQuestion.replace(/\s+/g, " ").trim();
    if (question.length < 3) return { ok: false, error: DomainError.validation("Write a question first.") };
    if (question.length > ASK_MAX_QUESTION) return { ok: false, error: DomainError.validation(`Keep the question under ${ASK_MAX_QUESTION} characters.`) };

    const mine = await this.visible.for(ctx);
    if (!mine.ok) return mine;
    if (!mine.value.some((p) => p.id === projectId)) return { ok: false, error: DomainError.notFound("Project", projectId) };

    const org = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!org.ok) return org;
    if (!org.value?.askEnabled || !org.value.aiEnabled) {
      return { ok: true, value: { available: false, reason: "Ask DonorDesk is switched off for this organisation. An administrator can turn it on in Settings." } };
    }

    // A cap on questions, so a loop or a script cannot spend the organisation's model budget.
    const tenant = String(ctx.tenant.tenantId);
    const now = this.clock.now();
    const [hour, day] = [await this.usage.countRuns(tenant, ASK_OPERATION, new Date(now.getTime() - 3_600_000)), await this.usage.countRuns(tenant, ASK_OPERATION, new Date(now.getTime() - 86_400_000))];
    if (!hour.ok) return hour;
    if (!day.ok) return day;
    if (hour.value >= HOURLY_LIMIT || day.value >= DAILY_LIMIT) return { ok: false, error: new DomainError("RATE_LIMITED", "Too many questions just now. Try again in a little while.") };

    const provider = await this.llmFor(tenant);
    if (!provider) return { ok: true, value: { available: false, reason: "The AI service is not available for this organisation right now." } };

    const gathered = await this.gather(ctx, projectId);
    if (!gathered.ok) return gathered;
    const { candidates, counts } = gathered.value;
    const sources = selectSources(question, candidates);

    let answer: AskAnswer;
    try {
      // Personal details are redacted in the question and in every source; the check below reads the same redacted sources, so
      // a figure the model quotes is compared with exactly what it was shown.
      const redactedSources = sources.map((s) => ({ ...s, text: redactForLlm(s.text) }));
      const redactedPrompt = buildAskPrompt(redactForLlm(question), redactedSources);
      const reply = await provider.complete({ systemPrompt: redactedPrompt.system, userPrompt: redactedPrompt.user, jsonMode: true, maxTokens: 4096, temperature: 0.1 });
      answer = groundAnswer(reply.text, redactedSources);
    } catch {
      return { ok: true, value: { available: false, reason: "The AI service did not answer. Try again in a moment." } };
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "ask.question", entityType: "project", entityId: projectId, projectId,
      newValue: JSON.stringify({ length: question.length, status: answer.status, sources: [...new Set(answer.sentences.flatMap((s) => s.sources.map((x) => x.id)))], dropped: answer.dropped }),
    });

    return {
      ok: true,
      value: {
        available: true, status: answer.status, answer: answer.sentences.map((s) => s.text), sentences: answer.sentences,
        missing: answer.status === "NOT_FOUND" && answer.missing.length === 0 ? [NOT_FOUND_SENTENCE] : answer.missing, dropped: answer.dropped, looked: counts,
      },
    };
  }

  private async gather(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ candidates: AskCandidate[]; counts: { indicators: number; activities: number; evidence: number } }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const [project, sheet, activities, files] = await Promise.all([
      this.projects.findById(projectId, tenantId),
      this.sheets.handle(ctx, projectId),
      this.activities.findByProject(projectId, tenantId),
      // Evidence the asker could not open is not read at all.
      this.evidence.search({ projectId, allowedConfidentialityLevels: readableConfidentialityLevels(ctx.tenant.role as Role), pageSize: 100 }, tenantId),
    ]);
    if (!project.ok) return project;
    if (!project.value) return { ok: false, error: DomainError.notFound("Project", projectId) };
    if (!sheet.ok) return sheet;
    if (!activities.ok) return activities;
    if (!files.ok) return files;
    // Finance is not part of this feature: it has its own gate and its own screens.
    const indicators = indicatorCandidates({ ...sheet.value, finance: [], registerFinance: undefined });
    const acts = activityCandidates(
      activities.value.filter((a) => a.status === "ACCEPTED" && !a.supersededById).slice(0, 200).map((a) => ({
        title: a.activityTitle, date: toPlainDate(a.activityDate) ?? undefined, location: a.location, summary: a.summary, participants: a.participantsTotal,
      })),
    );
    const evidence = evidenceCandidates(files.value.items.map((f) => ({ title: f.title, text: f.extractedText, verified: f.verificationStatus === "VERIFIED" })));
    const p = project.value;
    return {
      ok: true,
      value: {
        candidates: [
          projectCandidate({ title: p.title, projectCode: p.projectCode, donorName: p.donorName, country: p.country, sector: p.sector, start: toPlainDate(p.duration.start) ?? undefined, end: toPlainDate(p.duration.end) ?? undefined, description: p.description }),
          ...indicators, ...acts, ...evidence,
        ],
        counts: { indicators: indicators.length, activities: acts.length, evidence: evidence.length },
      },
    };
  }
}
