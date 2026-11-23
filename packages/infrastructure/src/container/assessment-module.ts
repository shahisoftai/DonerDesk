import type { PrismaClient } from "@prisma/client";
import {
  ApplyFormKitHandler, AssessmentRecorder, AssignFacilitiesHandler, CompareVisitsHandler, CreateCorrectiveActionHandler, DiscardCollectionDraftHandler, ExpireCollectionDraftsHandler,
  ExportAssessmentHandler, GetAssessmentPrefillHandler, GetCollectionDraftHandler, GetRecordScoreHandler, ListFacilityAssignmentsHandler, ListFormKitsHandler, ListMyAssignmentsHandler,
  ListMyCollectionDraftsHandler, MoveAssignmentHandler, ProposeFormFromFileHandler, SaveCollectionDraftHandler,
  type IAuditLogger, type IClock, type ICollectionFormRepository, type ICollectionRecordRepository, type IDocumentParser, type IIdGenerator, type IPersonNotifier, type IPlaceRepository, type IProjectRoster,
  type SaveCollectionFormHandler,
} from "@donordesk/application";
import { AssessmentDocumentFiles } from "../exports/assessment-document-files.js";
import { PrismaCollectionAssignmentRepository, PrismaCollectionDraftRepository } from "../repositories/collection-assessments.js";

export interface AssessmentModuleDeps {
  prisma: PrismaClient; ids: IIdGenerator; clock: IClock; audits: IAuditLogger;
  forms: ICollectionFormRepository; records: ICollectionRecordRepository; places: IPlaceRepository; roster: IProjectRoster; notifier: IPersonNotifier; parser: IDocumentParser;
  /** The ordinary save, request and problem handlers: assessments add to them and never write around them. */
  save: Pick<SaveCollectionFormHandler, "handle">;
  tasks: ConstructorParameters<typeof CreateCorrectiveActionHandler>[3];
  risks: ConstructorParameters<typeof CreateCorrectiveActionHandler>[4];
}

/** Assessments and long surveys (Phase 62) as one module: its repositories, the recorder the submit path uses, and the handlers. */
export function createAssessmentModule(deps: AssessmentModuleDeps) {
  const { prisma, ids, clock, audits, forms, records, places, roster, notifier, parser, save, tasks, risks } = deps;
  const drafts = new PrismaCollectionDraftRepository(prisma);
  const assignments = new PrismaCollectionAssignmentRepository(prisma);
  const recorder = new AssessmentRecorder(places, records, drafts, assignments, audits);
  return {
    recorder,
    /** Read by the offline pack (Phase 62): the person's facilities and the last visit's carried facts. */
    pack: { assignments, records },
    handlers: {
      saveCollectionDraft: new SaveCollectionDraftHandler(ids, forms, drafts, clock),
      getCollectionDraft: new GetCollectionDraftHandler(drafts),
      listMyCollectionDrafts: new ListMyCollectionDraftsHandler(drafts, clock),
      discardCollectionDraft: new DiscardCollectionDraftHandler(drafts),
      expireCollectionDrafts: new ExpireCollectionDraftsHandler(drafts, audits, clock),
      assignFacilities: new AssignFacilitiesHandler(ids, forms, assignments, places, roster, notifier, audits, clock),
      moveAssignment: new MoveAssignmentHandler(assignments, audits, clock),
      listFacilityAssignments: new ListFacilityAssignmentsHandler(forms, assignments, places),
      listMyAssignments: new ListMyAssignmentsHandler(assignments, forms, places),
      getAssessmentPrefill: new GetAssessmentPrefillHandler(forms, records),
      compareVisits: new CompareVisitsHandler(forms, records),
      getRecordScore: new GetRecordScoreHandler(forms, records),
      createCorrectiveAction: new CreateCorrectiveActionHandler(forms, records, places, tasks, risks),
      applyFormKit: new ApplyFormKitHandler(save),
      listFormKits: new ListFormKitsHandler(),
      proposeFormFromFile: new ProposeFormFromFileHandler(parser),
      exportAssessment: new ExportAssessmentHandler(forms, records, places, new AssessmentDocumentFiles()),
    },
  };
}

export type AssessmentHandlers = ReturnType<typeof createAssessmentModule>["handlers"];
