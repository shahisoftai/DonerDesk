import { DomainError, computeScore, qualityFlags, takesAnswer, type Result, type SubmissionResult, type TenantId } from "@donordesk/domain";
import type { IAuditLogger } from "../../ports/core.js";
import type { ICollectionAssignmentRepository, ICollectionDraftRepository, ICollectionRecordRepository, StoredCollectionForm, StoredCollectionRecord } from "../../ports/collection.js";
import type { IPlaceRepository } from "../../ports/places.js";
import { fail, ok, placeKeyOf } from "./assessment-common.js";

/** What a record carries beyond its answers (Phase 62): the facility, the visit number, the score, the quality flags and how answers were established. */
export type RecordExtras = Pick<StoredCollectionRecord, "visitNo" | "answersVersion" | "how" | "flags" | "score"> & { placeId?: string; startedAt?: Date };

export interface RecordIntent { placeId?: string | undefined; startedAt?: Date | undefined; now: Date }

/**
 * Turns a checked submission into the extras a record stores, and closes what the record settles. Before storing: the facility must be
 * a live place (a facility for a facility form), the visit is numbered per facility, the score is worked out with the form's own rules
 * and the quality flags are raised (they never block). After storing: the person's draft for that facility is removed and the
 * assignment, if there is one, is done. A form with no score, no subject and no draft behaves exactly as before.
 */
export class AssessmentRecorder {
  constructor(
    private readonly places: IPlaceRepository, private readonly records: Pick<ICollectionRecordRepository, "listByPlace">,
    private readonly drafts: Pick<ICollectionDraftRepository, "delete">, private readonly assignments: Pick<ICollectionAssignmentRepository, "findByFormAndPlace" | "update">,
    private readonly audit: IAuditLogger,
  ) {}

  async prepare(form: StoredCollectionForm, checked: SubmissionResult, intent: RecordIntent): Promise<Result<RecordExtras, DomainError>> {
    const def = form.definition;
    const subject = def.subject ?? "NONE";
    const extras: RecordExtras = { answersVersion: 2 };
    if (Object.keys(checked.how).length > 0) extras.how = checked.how;
    if (intent.startedAt) extras.startedAt = intent.startedAt;

    let pin: { lat: number; lon: number } | undefined;
    if (subject !== "NONE") {
      if (!intent.placeId) return fail(DomainError.validation(subject === "FACILITY" ? "Choose the facility this assessment is about." : "Choose the place this record is about."));
      const place = await this.places.findById(intent.placeId, form.tenantId);
      if (!place.ok) return place;
      if (!place.value || place.value.archivedAt) return fail(DomainError.validation("That place is not in the list of places."));
      if (subject === "FACILITY" && place.value.facility !== true) return fail(DomainError.validation("That place is not marked as a facility. Mark it on the Places page first."));
      extras.placeId = intent.placeId;
      if (place.value.latitude !== undefined && place.value.longitude !== undefined) pin = { lat: place.value.latitude, lon: place.value.longitude };
    }

    let earlierInMonth = false;
    if (extras.placeId) {
      const before = await this.records.listByPlace(form.id, extras.placeId, form.tenantId);
      if (!before.ok) return before;
      const live = before.value.filter((r) => r.status !== "REJECTED");
      extras.visitNo = live.length + 1;
      const month = intent.now.toISOString().slice(0, 7);
      earlierInMonth = live.some((r) => r.submittedOn.startsWith(month));
    }

    if (def.score) {
      const s = computeScore(def.score, checked.values);
      extras.score = { overall: s.overall, ...(s.band ? { band: s.band.label, tone: s.band.tone } : {}), answered: s.answered, total: s.total };
    }

    const gps = Object.values(checked.values).find((v): v is { lat: number; lon: number } => typeof v === "object" && v !== null && "lat" in v && "lon" in v);
    const asked = def.fields.filter(takesAnswer).length;
    const flags = qualityFlags({ startedAt: intent.startedAt, submittedAt: intent.now, answered: Object.keys(checked.values).length, asked, gps, facilityPin: pin, sameFacilityInPeriod: earlierInMonth });
    if (flags.length > 0) extras.flags = flags;
    return ok(extras);
  }

  /** Runs after the record is stored. Never fails the submission: the record is the truth, these only tidy up. */
  async after(form: StoredCollectionForm, record: { id: string; placeId?: string | undefined }, userId: string | undefined, tenantId: TenantId): Promise<void> {
    if (userId) await this.drafts.delete(form.id, userId, placeKeyOf(record.placeId), tenantId);
    if (!record.placeId) return;
    const found = await this.assignments.findByFormAndPlace(form.id, record.placeId, tenantId);
    if (!found.ok || !found.value || found.value.status === "DONE") return;
    await this.assignments.update({ ...found.value, status: "DONE", recordId: record.id, updatedAt: new Date() });
    await this.audit.record({ tenantId, actorId: userId ?? "link", eventType: "collection.assignment.done", entityType: "collection_assignment", entityId: found.value.id, projectId: form.projectId });
  }
}
