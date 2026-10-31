import { createHash } from "node:crypto";
import type { Result, Role, TenantId } from "@donordesk/domain";
import { DomainError, Permissions } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import { MAX_SETUP_DOCUMENTS, driveSourceKey, type ISetupDocumentStore, type ISetupLlm, type ISetupProposalRepository, type ISetupRunRepository } from "../../ports/project-setup.js";
import type { BackgroundRunner } from "../../services/background-runner.js";
import { emptySetupProposal, proposalExpiry } from "./proposal-state.js";
import type { SetupExtractionOrchestrator } from "./extraction-orchestrator.js";

export const SETUP_ASSIST_OPERATION = "SETUP_ASSIST";

export interface SetupDocumentInput {
  fileName: string;
  fileType: string;
  /** The uploaded document's bytes (for pasted text, the text as bytes). Saved to the organisation's own Google Drive and not kept on the server. */
  buffer: Buffer;
}

/** One document (the original shape) or a set of up to `MAX_SETUP_DOCUMENTS`. */
export type StartSetupExtractionInput = SetupDocumentInput | { documents: SetupDocumentInput[] };

export interface SetupExtractionStarted {
  proposalId: string;
  status: "EXTRACTING";
  sourceName: string;
}

/**
 * Starts a setup extraction (Phase 36): checks the permission, the organisation's opt-in and the daily cap, stores the
 * document in the organisation's own Google Drive (never on DonorDesk's servers), creates the proposal (EXTRACTING) and its run, and schedules the reading through the
 * background runner. A long document takes minutes; the screen polls the proposal. The audit carries the document's
 * length, never its text.
 */
export class StartSetupExtractionHandler {
  constructor(
    private readonly orgs: IOrganizationRepository,
    private readonly proposals: ISetupProposalRepository,
    private readonly runs: ISetupRunRepository,
    private readonly documents: ISetupDocumentStore,
    private readonly llm: ISetupLlm,
    private readonly orchestrator: SetupExtractionOrchestrator,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
    private readonly ids: IIdGenerator,
    private readonly runInBackground: BackgroundRunner,
    private readonly maxRunsPerDay: number,
  ) {}

  async handle(ctx: AuthenticatedContext, input: StartSetupExtractionInput): Promise<Result<SetupExtractionStarted, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.create")) {
      return { ok: false, error: DomainError.forbidden("You cannot create projects, so you cannot start a setup from a document") };
    }
    const tenantId = ctx.tenant.tenantId;
    const org = await this.orgs.findByTenant(tenantId);
    if (!org.ok) return org;
    if (!org.value?.setupAssistEnabled || !org.value.aiEnabled) {
      return { ok: false, error: new DomainError("POLICY_DENIED", "Setup assistance is switched off for this organisation. An administrator can turn it on in Settings.") };
    }
    if (!(await this.llm.available(tenantId))) {
      return { ok: false, error: new DomainError("POLICY_DENIED", "The AI service is not available for this organisation right now.") };
    }
    const documents = "documents" in input ? input.documents : [input];
    if (documents.length === 0) return { ok: false, error: DomainError.validation("Add a document first.") };
    if (documents.length > MAX_SETUP_DOCUMENTS) {
      return { ok: false, error: DomainError.validation(`Add at most ${MAX_SETUP_DOCUMENTS} documents at a time. Put the most important ones first.`) };
    }
    if (documents.some((d) => d.buffer.length === 0)) {
      return { ok: false, error: DomainError.validation("One of the files is empty. Choose files with some content in them.") };
    }
    const now = this.clock.now();
    const started = await this.proposals.countStartedSince(tenantId, new Date(now.getTime() - 24 * 60 * 60 * 1000));
    if (!started.ok) return started;
    if (started.value >= this.maxRunsPerDay) {
      return { ok: false, error: new DomainError("RATE_LIMITED", `At most ${this.maxRunsPerDay} documents a day across the organisation. Try again tomorrow.`) };
    }
    if (!(await this.documents.available(tenantId))) {
      return { ok: false, error: new DomainError("POLICY_DENIED", "Project documents are kept in your organisation's own Google Drive, and Drive is not connected. Connect Google Drive in Settings first, then add your document again.") };
    }
    const id = this.ids.generate();
    const names = documents.map((d) => d.fileName.replace(/\s+/g, " ").trim().slice(0, 200) || "document");
    const sourceName = names.length === 1 ? names[0]! : `${names[0]} (+${names.length - 1} more)`;
    // A Drive failure returns before anything is written to the database: no half-created proposal, and nothing left behind.
    const staged: string[] = [];
    for (const [i, doc] of documents.entries()) {
      const saved = await this.documents.stage(tenantId, { name: names[i]!, mimeType: doc.fileType || "application/octet-stream", bytes: doc.buffer });
      if (!saved.ok) {
        for (const fileId of staged) await this.documents.removeStaged(tenantId, fileId);
        return saved;
      }
      staged.push(saved.value.fileId);
    }
    const storageKey = driveSourceKey(staged);
    const totalLength = documents.reduce((n, d) => n + d.buffer.length, 0);
    const proposal = {
      id,
      tenantId,
      createdById: ctx.tenant.userId,
      status: "EXTRACTING" as const,
      sourceName,
      sourceStorageKey: storageKey,
      sourceHash: createHash("sha256").update(documents.map((d) => createHash("sha256").update(d.buffer).digest("hex")).join(":")).digest("hex"),
      sourceLength: totalLength,
      proposal: emptySetupProposal(),
      problems: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: proposalExpiry(now),
    };
    const created = await this.proposals.create(proposal);
    if (!created.ok) return created;
    const runStarted = await this.runs.start({
      id: this.ids.generate(),
      tenantId,
      proposalId: id,
      kind: "EXTRACT",
      status: "RUNNING",
      detail: { sourceLength: totalLength, documents: documents.length },
      startedAt: now,
    });
    if (!runStarted.ok) return runStarted;
    await this.audit.record({
      tenantId, actorId: ctx.tenant.userId, eventType: "setup.extraction.started", entityType: "project_setup_proposal", entityId: id,
      newValue: JSON.stringify({ length: totalLength, documents: documents.length }),
    });
    this.runInBackground(() => this.orchestrator.run({ tenantId, proposalId: id, userId: ctx.tenant.userId }).then(() => undefined));
    return { ok: true, value: { proposalId: id, status: "EXTRACTING", sourceName } };
  }
}
