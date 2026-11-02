import type { FastifyInstance } from "fastify";
import { SETUP_AREA_KEYS, type SetupAreaKey, type SetupOperation, type ResultOperation, type PlaceOperation, type PlanOperation, type FinanceOperation, type RiskOperation } from "@donordesk/domain";
import { MAX_SETUP_DOCUMENTS } from "@donordesk/application";
import { ApplySetupProposalSchema, EditSetupProposalSchema, SetSetupDocumentKindSchema, SetupAreaSelectionSchema, SetupAssistSettingsSchema, SetupPackSchema, SetupAreaKeySchema, SetupOperationSchema, SetupFinanceOperationSchema, SetupPlaceOperationSchema, SetupPlanOperationSchema, SetupResultOperationSchema, SetupRiskOperationSchema, StartBlankSetupSchema, StartSetupTextSchema } from "@donordesk/contracts";

/**
 * The AI project setup wizard's routes (Phase 36). The older `project-setup.ts` file is the setup checklist; these are
 * the document-proposal routes. Everything is inside the authenticated scope; the handlers enforce creator-only access.
 */
export async function registerProjectSetupWizardRoutes(app: FastifyInstance) {
  // The Project Creation Wizard (Phase 38): a draft with or without documents, read and edited slide by slide. A start from
  // documents uses the proposals route above; both make the same kind of draft.
  app.post("/v1/project-setup/drafts", async (req) => {
    const body = StartBlankSetupSchema.parse(req.body ?? {});
    const r = await req.container.handlers.startBlankSetup.handle({ tenant: req.tenant, requestId: req.id }, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/project-setup/drafts/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const r = await req.container.handlers.getSetupDraft.handle({ tenant: req.tenant, requestId: req.id }, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/project-setup/drafts/:id/operations", async (req) => {
    const id = (req.params as { id: string }).id;
    const op = SetupOperationSchema.parse(req.body) as unknown as SetupOperation;
    const r = await req.container.handlers.editSetupDraft.handle({ tenant: req.tenant, requestId: req.id }, id, op);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Results framework and indicator edits change the proposal itself (Phase 38.3).
  app.post("/v1/project-setup/drafts/:id/results", async (req) => {
    const id = (req.params as { id: string }).id;
    const op = SetupResultOperationSchema.parse(req.body) as unknown as ResultOperation;
    const r = await req.container.handlers.changeSetupResults.handle({ tenant: req.tenant, requestId: req.id }, id, op);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/project-setup/drafts/:id/places", async (req) => {
    const id = (req.params as { id: string }).id;
    const op = SetupPlaceOperationSchema.parse(req.body) as unknown as PlaceOperation;
    const r = await req.container.handlers.changeSetupPlaces.handle({ tenant: req.tenant, requestId: req.id }, id, op);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/project-setup/drafts/:id/plan", async (req) => {
    const id = (req.params as { id: string }).id;
    const op = SetupPlanOperationSchema.parse(req.body) as unknown as PlanOperation;
    const r = await req.container.handlers.changeSetupPlan.handle({ tenant: req.tenant, requestId: req.id }, id, op);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/project-setup/drafts/:id/finance", async (req) => {
    const id = (req.params as { id: string }).id;
    const op = SetupFinanceOperationSchema.parse(req.body) as unknown as FinanceOperation;
    const r = await req.container.handlers.changeSetupFinance.handle({ tenant: req.tenant, requestId: req.id }, id, op);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/project-setup/drafts/:id/risks", async (req) => {
    const id = (req.params as { id: string }).id;
    const op = SetupRiskOperationSchema.parse(req.body) as unknown as RiskOperation;
    const r = await req.container.handlers.changeSetupRisks.handle({ tenant: req.tenant, requestId: req.id }, id, op);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // The server records who signed and when; the request carries nothing about it.
  app.post("/v1/project-setup/drafts/:id/sign-off", async (req) => {
    const id = (req.params as { id: string }).id;
    const r = await req.container.handlers.signOffSetup.handle({ tenant: req.tenant, requestId: req.id }, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Starts the project. The server re-checks every requirement and the sign-off; nothing in the request decides.
  app.post("/v1/project-setup/drafts/:id/launch", async (req) => {
    const id = (req.params as { id: string }).id;
    const r = await req.container.handlers.launchProject.handle({ tenant: req.tenant, requestId: req.id }, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/project-setup/drafts/:id/pack", async (req) => {
    const id = (req.params as { id: string }).id;
    const r = await req.container.handlers.applyDefaultPack.handle({ tenant: req.tenant, requestId: req.id }, id);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Start: a multipart upload, or pasted text as JSON. The document is saved to the organisation's own Google Drive (the server keeps no copy); the model never
  // sees project records, and nothing writes until the person applies (Phase 36.3).
  app.post("/v1/project-setup/proposals", async (req) => {
    const contentType = String(req.headers["content-type"] ?? "");
    const documents: Array<{ fileName: string; fileType: string; buffer: Buffer }> = [];
    if (contentType.includes("multipart/form-data")) {
      // Up to MAX_SETUP_DOCUMENTS files; one past the limit is refused by the handler with a plain sentence.
      for await (const part of req.files()) {
        documents.push({ fileName: part.filename ?? "document", fileType: part.mimetype ?? "application/octet-stream", buffer: await part.toBuffer() });
        if (documents.length > MAX_SETUP_DOCUMENTS) break;
      }
      if (documents.length === 0) return { ok: false };
    } else {
      const body = StartSetupTextSchema.parse(req.body);
      documents.push({ fileName: body.fileName ?? "Project description (pasted text).txt", fileType: "text/plain", buffer: Buffer.from(body.text, "utf8") });
    }
    const r = await req.container.handlers.startSetupExtraction.handle({ tenant: req.tenant, requestId: req.id }, { documents });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/project-setup/proposals", async (req) => {
    const r = await req.container.handlers.listSetupProposals.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    return { proposals: r.value.map(withoutStorageKey) };
  });

  app.get("/v1/project-setup/proposals/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const r = await req.container.handlers.getSetupProposal.handle({ tenant: req.tenant, requestId: req.id }, id);
    if (!r.ok) throw r.error;
    return { ...r.value, proposal: withoutStorageKey(r.value.proposal) };
  });

  app.patch("/v1/project-setup/proposals/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = EditSetupProposalSchema.parse(req.body);
    const r = await req.container.handlers.editSetupProposal.handle({ tenant: req.tenant, requestId: req.id }, id, body);
    if (!r.ok) throw r.error;
    return { ok: true, updatedAt: r.value.updatedAt };
  });

  app.post("/v1/project-setup/proposals/:id/areas/:area/rerun", async (req) => {
    const id = (req.params as { id: string }).id;
    const area = SetupAreaKeySchema.parse((req.params as { area: string }).area);
    const r = await req.container.handlers.rerunSetupArea.handle({ tenant: req.tenant, requestId: req.id }, id, area);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // A person says what a document is; every part is then read again (Phase 37.6).
  app.put("/v1/project-setup/proposals/:id/documents/:documentId/kind", async (req) => {
    const { id, documentId } = req.params as { id: string; documentId: string };
    const body = SetSetupDocumentKindSchema.parse(req.body);
    const r = await req.container.handlers.setSetupDocumentKind.handle({ tenant: req.tenant, requestId: req.id }, id, documentId, body.kind);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // The passage a proposed item was read from, as the model saw it (Phase 37.6).
  app.get("/v1/project-setup/proposals/:id/passages/:documentId/:block", async (req) => {
    const { id, documentId, block } = req.params as { id: string; documentId: string; block: string };
    const index = Number(block);
    if (!Number.isInteger(index) || index < 0) return { ok: false };
    const r = await req.container.handlers.getSetupSourcePassage.handle({ tenant: req.tenant, requestId: req.id }, id, documentId, index);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Preview saves nothing; apply creates the project from the person's form, then each accepted area (Phase 36.3).
  app.post("/v1/project-setup/proposals/:id/preview", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = SetupAreaSelectionSchema.parse(req.body ?? {});
    const r = await req.container.handlers.previewSetupApply.handle({ tenant: req.tenant, requestId: req.id }, id, selection(body.areas));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/project-setup/proposals/:id/apply", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = ApplySetupProposalSchema.parse(req.body);
    const r = await req.container.handlers.applySetupProposal.handle({ tenant: req.tenant, requestId: req.id }, id, { project: body.project, areas: selection(body.areas) });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/project-setup/proposals/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const r = await req.container.handlers.discardSetupProposal.handle({ tenant: req.tenant, requestId: req.id }, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.put("/v1/organization/setup-assist", async (req) => {
    const body = SetupAssistSettingsSchema.parse(req.body);
    const r = await req.container.handlers.updateSetupAssistSettings.handle({ tenant: req.tenant, requestId: req.id }, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  // The organisation's own default packs (Settings). The handler checks the pack; the route only passes it on.
  app.get("/v1/organization/setup-packs", async (req) => {
    const r = await req.container.handlers.listOrganisationPacks.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    return r.value;
  });
  app.put("/v1/organization/setup-packs", async (req) => {
    const r = await req.container.handlers.saveOrganisationPack.handle({ tenant: req.tenant, requestId: req.id }, SetupPackSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
  app.delete("/v1/organization/setup-packs/:sectorKey", async (req) => {
    const r = await req.container.handlers.removeOrganisationPack.handle({ tenant: req.tenant, requestId: req.id }, (req.params as { sectorKey: string }).sectorKey);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}

/** Omitted areas = every area. */
function selection(areas: ReadonlyArray<SetupAreaKey> | undefined): Partial<Record<SetupAreaKey, boolean>> {
  return Object.fromEntries((areas ?? SETUP_AREA_KEYS).map((a) => [a, true]));
}

/** The stored document's storage key is server-side: the browser reads the proposal, never where its file lives. */
function withoutStorageKey<T extends { sourceStorageKey: string }>(p: T): Omit<T, "sourceStorageKey"> {
  const { sourceStorageKey: _key, ...rest } = p;
  return rest;
}
