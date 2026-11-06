/**
 * The server-backed answers to the Record forms' extra questions. Every call is guarded, so no connection is an ordinary "not now",
 * never an exception. The offline versions are `offlineServices`.
 */
import { askToOpenPeriodAction, openPeriodForDateAction, periodProposalAction } from "@/lib/actions/record";
import { loadReportingProfileAction } from "@/lib/actions/setup";
import { guardNetwork, OFFLINE_MESSAGE } from "@/lib/shared/connectivity";
import type { PeriodOpener, ProjectFacts } from "../ports/record-services";

export function createNetworkServices(): { periods: PeriodOpener; facts: ProjectFacts } {
  return {
    periods: {
      proposal: async (projectId, date) => {
        const r = await guardNetwork(() => periodProposalAction(projectId, date));
        return r.ok ? r.value : null;
      },
      open: async (projectId, date) => {
        const r = await guardNetwork(() => openPeriodForDateAction(projectId, date));
        return r.ok ? { ok: true } : { ok: false, message: r.error.message };
      },
      ask: async (projectId, date) => {
        const r = await guardNetwork(() => askToOpenPeriodAction(projectId, date));
        return r.ok ? { ok: true } : { ok: false, message: r.error.message };
      },
    },
    facts: {
      simpleReview: async (projectId) => {
        try {
          const r = await loadReportingProfileAction(projectId);
          return r.ok && r.value.profile?.simpleReview === true;
        } catch {
          return false;
        }
      },
    },
  };
}

/** With no connection nothing here can be asked: the form shows its own note and the person keeps working. */
export function offlineServices(): { periods: PeriodOpener; facts: ProjectFacts } {
  return {
    periods: { proposal: async () => null, open: async () => ({ ok: false, message: OFFLINE_MESSAGE }), ask: async () => ({ ok: false, message: OFFLINE_MESSAGE }) },
    facts: { simpleReview: async () => false },
  };
}
