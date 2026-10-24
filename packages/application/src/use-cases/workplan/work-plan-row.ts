import {
  evidenceCoverage, DELIVERY_SIGNAL_LABEL, reasonRequired, deliveryReason, deliverySignal, deliveryState, suggestPlanStatus,
  type DeliveryFacts, type DeliverySignal, type DeliveryState, type PlainDate, type PlanStatus, type PlannedActivity,
} from "@donordesk/domain";

export interface WorkPlanRowDto {
  id: string;
  title: string;
  kind: "ACTIVITY" | "MILESTONE";
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  /** Present only when the dates were moved ("moved from …"). */
  originalStart?: PlainDate;
  originalEnd?: PlainDate;
  status: PlanStatus;
  state: DeliveryState;
  signal: DeliverySignal;
  signalLabel: string;
  signalReason?: string;
  ownerUserId?: string;
  supportUserIds: string[];
  logframeActivityId?: string;
  outputId?: string;
  location?: string;
  /// A hand-placed place when no gazetteer name matches (both together, Phase 30.1).
  latitude?: number;
  longitude?: number;
  targetCount?: number;
  /** How heavy it is for its lead, 1 to 5 (1 when not set). */
  effort: number;
  deliveredCount: number;
  completedActivities: number;
  /** "IN_PROGRESS" or "DONE" when completed activities suggest it; the person confirms. */
  suggestedStatus?: "IN_PROGRESS" | "DONE";
  seriesId?: string;
  /** Kinds of file that should prove it, and the ones no completed activity has shown yet. */
  requiredFiles: string[];
  stillNeeded: string[];
  /** Moving or changing it needs a "Why?" (original end passed, or a report covers it). */
  reasonRequired: boolean;
  /** "Comes after": activities that must finish first, and whether each is finished (phase 28.1-A). */
  comesAfter?: Array<{ id: string; title: string; finished: boolean }>;
  /** "Comes before": activities that wait for this one. */
  comesBefore?: Array<{ id: string; title: string }>;
  /** The unfinished ones among comesAfter: shown as "Waiting for …". */
  waitingFor?: Array<{ id: string; title: string; finished: boolean }>;
}

/**
 * One planned activity as a person reads it: its derived delivery state and signal, the reason in words, the suggestion
 * from completed activities, and whether changing it needs a "Why?". The one place a row is built, so the project plan
 * and My week can never disagree about whether something is late.
 */
export function toWorkPlanRow(i: PlannedActivity, f: DeliveryFacts, today: PlainDate, reportCovers: boolean): WorkPlanRowDto {
  const snap = i.snapshot();
  const view = { status: i.status, plannedStart: i.plannedStart, plannedEnd: i.plannedEnd, ...(i.completedOn ? { completedOn: i.completedOn } : {}) };
  const state = deliveryState(view, f, today);
  const reason = deliveryReason(state, view, today);
  const suggested = suggestPlanStatus({ ...view, ...(snap.targetCount !== undefined ? { targetCount: snap.targetCount } : {}) }, f);
  return {
    id: i.id, title: i.title, kind: i.kind, plannedStart: i.plannedStart, plannedEnd: i.plannedEnd,
    ...(i.isMoved ? { originalStart: i.originalStart, originalEnd: i.originalEnd } : {}),
    status: i.status, state, signal: deliverySignal(state), signalLabel: DELIVERY_SIGNAL_LABEL[deliverySignal(state)], ...(reason ? { signalReason: reason } : {}),
    ...(i.ownerUserId ? { ownerUserId: i.ownerUserId } : {}), supportUserIds: [...i.supportUserIds],
    ...(i.logframeActivityId ? { logframeActivityId: i.logframeActivityId } : {}), ...(snap.outputId ? { outputId: snap.outputId } : {}),
    ...(snap.location ? { location: snap.location } : {}),
    ...(snap.latitude !== undefined && snap.longitude !== undefined ? { latitude: snap.latitude, longitude: snap.longitude } : {}),
    ...(snap.targetCount !== undefined ? { targetCount: snap.targetCount } : {}),
    effort: snap.effort ?? 1,
    deliveredCount: f.deliveredCount, completedActivities: f.liveRecords, ...(suggested ? { suggestedStatus: suggested } : {}),
    ...(i.seriesId ? { seriesId: i.seriesId } : {}),
    requiredFiles: [...i.requiredFiles],
    // Across all its completed activities: a kind shown by any of them is no longer missing.
    stillNeeded: f.liveRecords === 0 ? [] : evidenceCoverage(i.requiredFiles, f.evidenceTypes ?? []).stillNeeded,
    reasonRequired: reasonRequired({ originalEnd: i.originalEnd }, today, { reportUsesIt: reportCovers }),
  };
}
