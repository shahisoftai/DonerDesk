"use client";

/**
 * The only place that decides which adapters the Record screens use (Phase 44). The signed-in app reads from the server; `/field`
 * (which must open with no signal and holds no session on the server) reads from the packs on the phone. Both write through the same
 * sink, which saves now or keeps the record on the phone. Presentation never imports an adapter or an action directly: it gets a
 * `RecordDeps` from here, so the same forms run in both places and a test can hand them anything.
 */
import { useMemo, useRef } from "react";
import { downloadOfflinePackAction, listFieldProjectsAction } from "@/lib/actions/offline";
import { quickEnterValueAction } from "@/lib/actions/indicators";
import { changePlanStatusAction, completePlannedActivityAction } from "@/lib/actions/workplan";
import { guardNetwork } from "@/lib/shared/connectivity";
import type { OfflinePack } from "@/features/offline/domain/offline-pack";
import { useOutbox } from "@/features/offline/presentation/OutboxProvider";
import { createNetworkLookup } from "./adapters/network-lookup";
import { createPackLookup } from "./adapters/pack-lookup";
import { createNetworkServices, offlineServices } from "./adapters/network-services";
import { createValueSink } from "./adapters/value-sink";
import { createWorkSink } from "./adapters/work-sink";
import type { RecordLookup } from "./ports/record-lookup";
import type { PeriodOpener, ProjectFacts } from "./ports/record-services";
import type { ValueSink, WorkSink } from "./ports/record-sink";

export interface RecordDeps {
  lookup: RecordLookup;
  valueSink: ValueSink;
  workSink: WorkSink;
  periods: PeriodOpener;
  facts: ProjectFacts;
  online: boolean;
}

/** The server-backed extras, built once for the visit. Used by the Record sheet and by the `/enter` page. */
export function useNetworkServices(): { periods: PeriodOpener; facts: ProjectFacts } {
  return useMemo(() => createNetworkServices(), []);
}

/** The write side: shared by both hosts. The outbox is read through a ref so the sink keeps one identity while the queue changes. */
export function useRecordValueSink(): ValueSink {
  const outbox = useOutbox();
  const latest = useRef(outbox);
  latest.current = outbox;
  return useMemo(
    () =>
      createValueSink({
        send: (payload) => guardNetwork(() => quickEnterValueAction(payload)),
        enqueue: (entry) => latest.current.enqueue(entry),
        get canQueue() { return latest.current.supported; },
        newId: () => crypto.randomUUID(),
        now: () => Date.now(),
      }),
    [],
  );
}

/** The plan steps of "What happened?": the one-call completion and status changes, kept on the phone when there is no signal. */
export function useRecordWorkSink(): WorkSink {
  const outbox = useOutbox();
  const latest = useRef(outbox);
  latest.current = outbox;
  return useMemo(
    () =>
      createWorkSink({
        complete: (itemId, input) => guardNetwork(() => completePlannedActivityAction(itemId, input)),
        changeStatus: (itemId, input) => guardNetwork(() => changePlanStatusAction(itemId, input)),
        enqueue: (entry) => latest.current.enqueue(entry),
        get canQueue() { return latest.current.supported; },
        newId: () => crypto.randomUUID(),
        now: () => Date.now(),
      }),
    [],
  );
}

/** The signed-in app: the server is the source, fetched per project and kept for the visit. */
export function useNetworkRecordDeps(): RecordDeps {
  const outbox = useOutbox();
  const valueSink = useRecordValueSink();
  const workSink = useRecordWorkSink();
  const lookup = useMemo(() => {
    const names = new Map<string, string>();
    return createNetworkLookup({
      listProjects: async () => {
        const r = await listFieldProjectsAction();
        if (!r.ok) throw new Error(r.error.message);
        for (const p of r.value.projects) names.set(p.id, p.name);
        return r.value.projects;
      },
      fetchPack: async (projectId) => {
        const r = await downloadOfflinePackAction(projectId, names.get(projectId) ?? "");
        if (!r.ok) throw new Error(r.error.message);
        return r.value;
      },
    });
  }, []);
  const services = useNetworkServices();
  return { lookup, valueSink, workSink, ...services, online: outbox.online };
}

/** The field page: the packs on this phone are the source, so everything works with no signal. */
export function usePackRecordDeps(packs: readonly OfflinePack[]): RecordDeps {
  const outbox = useOutbox();
  const valueSink = useRecordValueSink();
  const workSink = useRecordWorkSink();
  const lookup = useMemo(() => createPackLookup(packs), [packs]);
  const services = useMemo(() => offlineServices(), []);
  return { lookup, valueSink, workSink, ...services, online: outbox.online };
}
