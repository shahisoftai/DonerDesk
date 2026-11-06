import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { createPackLookup } from "@/features/record/adapters/pack-lookup";
import { createValueSink } from "@/features/record/adapters/value-sink";
import { createWorkSink } from "@/features/record/adapters/work-sink";
import type { RecordDeps } from "@/features/record/composition";
import { RecordSheetBody } from "@/features/record/presentation/RecordSheetBody";
import { WaitingList } from "@/features/record/presentation/WaitingList";
import type { OfflinePack } from "@/features/offline/domain/offline-pack";
import type { Capability } from "@/lib/shared/capabilities";

type Call = [string, unknown[]];
const w = window as unknown as { __h: Record<string, unknown>; __call: (name: string, args: unknown[]) => Promise<unknown> };
const q = new URLSearchParams(location.hash.slice(1));
const has = (k: string) => q.get(k) === "1";

const ok = (value: unknown) => ({ ok: true, value });
const offlineError = { ok: false, error: { kind: "unavailable", message: "You appear to be offline.", retryable: true } };
w.__h = {
  calls: [] as Call[],
  outbox: { supported: true, online: !has("offline"), sending: false, entries: has("waiting") ? [
    { id: "e1", kind: "indicator-values", title: "A1: 320", state: "waiting", createdAt: 1, attempts: 0, payload: {} },
    { id: "e2", kind: "activity", title: "Hygiene session", state: "waiting", createdAt: 2, attempts: 0, payload: { files: [{}, {}, {}] } },
    { id: "e3", kind: "activity", title: "Water point survey", state: "needs-attention", createdAt: 3, attempts: 1, lastError: "The village name is missing.", payload: { files: [] } },
  ] : [] },
  proposal: { kind: "PROPOSE", reportType: "MONTHLY", target: { startDate: "2030-01-01", endDate: "2030-01-31" }, periods: [{ startDate: "2030-01-01", endDate: "2030-01-31" }] },
};
const h = w.__h as { calls: Call[]; proposal: unknown };
const answers: Record<string, unknown> = {
  quickEnterValueAction: () => (has("offline") ? offlineError : ok({ id: "u1", reportingPeriodId: "per-now", chosenBy: "DATE", cumulative: "", cumulativeSource: "NONE", outcome: "SAVED_DRAFT", notices: ["A running total was suggested."] })),
  createActivityAction: () => (has("offline") ? offlineError : ok({ id: "act-1" })),
  completePlannedActivityAction: () => ok({ activityId: "act-9" }),
  changePlanStatusAction: () => ok(true),
  uploadEvidenceAction: () => ok({}),
};
w.__call = (name, args) => { h.calls.push([name, args]); const a = answers[name]; const v = typeof a === "function" ? (a as (...x: unknown[]) => unknown)(...args) : a; return Promise.resolve(v ?? offlineError); };

// Periods follow the real calendar so that "today" lands in the current month, and a day two years ahead lands in none.
const iso = (d: Date) => d.toISOString().slice(0, 10);
const now = new Date();
const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
const periods = has("noPeriod")
  ? [{ id: "per-old", reportType: "MONTHLY", startDate: iso(prevStart), endDate: iso(prevEnd), status: "DRAFT" }]
  : [{ id: "per-old", reportType: "MONTHLY", startDate: iso(prevStart), endDate: iso(prevEnd), status: "APPROVED" }, { id: "per-now", reportType: "MONTHLY", startDate: iso(start), endDate: iso(end), status: has("locked") ? "APPROVED" : "DRAFT" }];
const pack: OfflinePack = {
  version: 2, userId: "u1", userName: "Amina", projectId: "p1", projectName: "Borno WASH", generatedAt: Date.now(),
  forms: [], places: [{ id: "pl1", name: "Kondo", path: "Kondo › Borno" }],
  indicators: [
    { id: "i1", code: "A1", name: "People with safe water", type: "NUMBER", disaggregationRequired: has("breakdown"), unit: "people" },
    { id: "i2", code: "A2", name: "Latrines built", type: "NUMBER", disaggregationRequired: false, unit: "latrines" },
  ],
  periods,
  plan: [{ id: "pa1", title: "Hygiene session", plannedStart: iso(now), plannedEnd: iso(now), status: "PLANNED", location: "Kondo" }, { id: "pa2", title: "Already finished", plannedStart: iso(now), plannedEnd: iso(now), status: "DONE" }],
};
if (has("v1")) { delete (pack as Partial<OfflinePack>).indicators; delete (pack as Partial<OfflinePack>).periods; delete (pack as Partial<OfflinePack>).plan; pack.version = 1; }

let n = 0;
const enqueue = async (e: unknown) => { h.calls.push(["outbox.enqueue", [e]]); };
const deps: RecordDeps = {
  lookup: createPackLookup([pack]),
  valueSink: createValueSink({ send: (p) => w.__call("quickEnterValueAction", [p]) as never, enqueue, canQueue: true, newId: () => `id-${++n}`, now: () => 1 }),
  workSink: createWorkSink({ complete: (id, b) => w.__call("completePlannedActivityAction", [id, b]) as never, changeStatus: (id, b) => w.__call("changePlanStatusAction", [id, b]) as never, enqueue, canQueue: true, newId: () => `id-${++n}`, now: () => 1 }),
  periods: {
    proposal: async () => (has("noCadence") ? { kind: "NONE", reason: "NO_CADENCE" } : (h.proposal as never)),
    open: async (...a) => { h.calls.push(["period.open", a]); return { ok: true }; },
    ask: async (...a) => { h.calls.push(["period.ask", a]); return { ok: true }; },
  },
  facts: { simpleReview: async () => has("simple") },
  online: !has("offline"),
};
const caps = (q.get("caps") ?? "indicator.update,activity.create,evidence.upload,workplan.update-own").split(",") as Capability[];
const request = { ...(q.get("kind") ? { kind: q.get("kind") as never } : {}), ...(q.get("plan") ? { plannedActivityId: q.get("plan") as string } : {}) };

createRoot(document.getElementById("root")!).render(
  <I18nProvider initialLocale={(q.get("lang") as "en") ?? "en"}>
    <div style={{ maxWidth: has("wide") ? 520 : undefined, margin: "0 auto", padding: 16 }} data-testid="host">
      {has("waiting") ? <WaitingList /> : <RecordSheetBody deps={deps} capabilities={caps} request={request} onClose={() => { h.calls.push(["close", []]); }} />}
    </div>
  </I18nProvider>,
);
