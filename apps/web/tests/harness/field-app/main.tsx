import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { FieldApp } from "@/features/offline/presentation/FieldApp";
import { createIndexedDbPackStore } from "@/features/offline/infrastructure/indexeddb-pack-store";
import type { OfflinePack } from "@/features/offline/domain/offline-pack";

type Call = [string, unknown[]];
const w = window as unknown as { __h: { calls: Call[]; refreshes: number; outbox: Record<string, unknown> }; __call: (name: string, args: unknown[]) => Promise<unknown> };
const q = new URLSearchParams(location.hash.slice(1));
const has = (k: string) => q.get(k) === "1";
const ok = (value: unknown) => ({ ok: true, value });

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d); };

const pack: OfflinePack = {
  version: 4, userId: "u1", userName: "Amina Khan", projectId: "p1", projectName: "Borno health facility assessment", generatedAt: Date.now(),
  forms: [
    { id: "f1", name: "Health facility assessment", subject: "FACILITY", fields: [
      { key: "sec1", type: "SECTION", label: "About the visit" },
      { key: "q_name", type: "TEXT", label: "Name of the person in charge", required: true },
      { key: "q_open", type: "YES_NO", label: "Is the facility open today?" },
    ] },
    { id: "f2", name: "Household survey", fields: [{ key: "q_hh", type: "NUMBER", label: "People in the household" }] },
  ],
  places: [
    { id: "pk", name: "Pakistan", path: "Pakistan" },
    { id: "a", name: "Cat-B Hospital Chakdara", path: "Dir Lower › K.P. › Pakistan", facility: true },
    { id: "b", name: "Cat-C Hospital Madyan", path: "Swat › K.P. › Pakistan", facility: true },
    { id: "c", name: "RHC Landiwah", path: "Lakki Marwat › K.P. › Pakistan", facility: true },
    { id: "d", name: "Cat-D Hospital Mathani", path: "Peshawar › K.P. › Pakistan", facility: true },
  ],
  assignments: has("empty") ? [] : [
    { id: "s1", formId: "f1", placeId: "a", status: has("started") ? "IN_PROGRESS" : "TO_DO", dueOn: plus(has("late") ? -2 : 0) },
    { id: "s2", formId: "f1", placeId: "b", status: "TO_DO", dueOn: plus(2) },
    { id: "s3", formId: "f1", placeId: "c", status: "TO_DO", dueOn: plus(5) },
    { id: "s4", formId: "f1", placeId: "d", status: "TO_DO" },
  ],
  plan: has("empty") ? [] : [
    { id: "w1", title: "Train the assessors", plannedStart: plus(0), plannedEnd: plus(1), status: "PLANNED", location: "Peshawar" },
    { id: "w2", title: "Hygiene session at the school", plannedStart: plus(3), plannedEnd: plus(3), status: "PLANNED", location: "Mathani" },
  ],
  prefill: [],
};
if (has("none")) { pack.assignments = []; }

w.__h = {
  calls: [], refreshes: 0,
  outbox: { supported: true, online: !has("offline"), sending: false, entries: has("waiting") ? [
    { id: "e1", kind: "collection-record", title: "Health facility assessment", state: "waiting", createdAt: 1, attempts: 0, payload: { files: [{}, {}] } },
    { id: "e2", kind: "activity", title: "Hygiene session", state: "needs-attention", createdAt: 3, attempts: 1, lastError: "The village name is missing.", payload: { files: [] } },
  ] : [] },
};
const answers: Record<string, unknown> = {
  listFieldProjectsAction: () => (has("nothing") ? ok({ userId: "u1", userName: "Amina Khan", projects: [] }) : ok({ userId: "u1", userName: "Amina Khan", projects: [{ id: "p1", name: pack.projectName, country: "Pakistan" }] })),
  downloadOfflinePackAction: () => ok({ ...pack, generatedAt: Date.now() }),
};
w.__call = (name, args) => { w.__h.calls.push([name, args]); const a = answers[name]; const v = typeof a === "function" ? (a as (...x: unknown[]) => unknown)(...args) : a; return Promise.resolve(v ?? ok({})); };

(async () => {
  const store = createIndexedDbPackStore(indexedDB);
  await store.clear();
  try { localStorage.removeItem("donordesk-field-user"); } catch { /* ignore */ }
  if (!has("none")) { await store.put(has("old") ? { ...pack, generatedAt: Date.now() - 3 * 86_400_000 } : pack); localStorage.setItem("donordesk-field-user", "u1"); }
  createRoot(document.getElementById("root")!).render(
    <I18nProvider initialLocale={(q.get("lang") as "en") ?? "en"}><div data-testid="host"><FieldApp /></div></I18nProvider>,
  );
})();
