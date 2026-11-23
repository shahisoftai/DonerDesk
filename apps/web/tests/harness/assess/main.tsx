import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { MESSAGES } from "@/features/i18n/messages";
import type { Locale } from "@/features/i18n/domain/locales";
import { createMemoryDraftStore } from "@/features/collection/adapters/memory-draft-store";
import { AssessmentFlow } from "@/features/collection/presentation/AssessmentFlow";

type Call = [string, unknown[]];
const w = window as unknown as { __h: { calls: Call[]; draftStore: ReturnType<typeof createMemoryDraftStore> }; __call: (name: string, args: unknown[]) => Promise<unknown> };
const q = new URLSearchParams(location.hash.slice(1));
const lang = (q.get("lang") ?? "en") as Locale;
w.__h = { calls: [], draftStore: createMemoryDraftStore() };
w.__call = (name, args) => { w.__h.calls.push([name, args]); return Promise.resolve({ ok: false, error: { kind: "unavailable", message: "stub", retryable: true } }); };

const definition = {
  subject: "FACILITY" as const,
  languages: ["ur"],
  constraints: [{ kind: "LTE" as const, fields: ["functional", "sanctioned"] }],
  score: {
    illustrative: true, minAnsweredShare: 0.5,
    bands: [{ min: 70, label: "Ready", tone: "GOOD" as const }, { min: 0, label: "Not ready", tone: "POOR" as const }],
    sections: [
      { key: "water", title: "Water", relevantWhen: { field: "has_water", op: "EQ" as const, value: "yes" }, items: [{ path: "checks.*.ok", label: "Check working", points: { yes: 1, no: 0 } }] },
      { key: "blocks", title: "Buildings", items: [{ path: "blocks.*.cond", label: "Condition", points: { good: 2, poor: 0 } }] },
    ],
  },
};
const fields = [
  { key: "sec_a", label: "About the facility", type: "SECTION", help: "Answer from what you see.", labels: { ur: "سہولت کے بارے میں" } },
  { key: "name", label: "Facility name", type: "TEXT", required: true, labels: { ur: "سہولت کا نام" } },
  { key: "year", label: "Year established", type: "NUMBER", carryForward: true },
  { key: "services", label: "Services offered", type: "MULTI_SELECT", options: [{ value: "opd", label: "OPD" }, { value: "er", label: "Emergency" }] },
  { key: "sanctioned", label: "Sanctioned beds", type: "NUMBER", min: 0 },
  { key: "functional", label: "Functional beds", type: "NUMBER", min: 0, allowNotApplicable: true },
  { key: "ratio", label: "Beds working (%)", type: "CALCULATED", formula: "functional / sanctioned * 100", decimals: 1 },
  { key: "sec_b", label: "Water", type: "SECTION" },
  { key: "has_water", label: "Does it have a water system?", type: "YES_NO", required: true },
  { key: "checks", label: "Water checks", type: "GRID", rows: [{ key: "tank", label: "Storage tank" }, { key: "tap", label: "Taps" }], columns: [{ key: "ok", label: "Working", type: "YES_NO", allowNotApplicable: true }, { key: "count", label: "How many", type: "NUMBER", min: 0, max: 20 }], relevantWhen: { field: "has_water", op: "EQ", value: "yes" } },
  { key: "sec_c", label: "Buildings", type: "SECTION" },
  { key: "blocks", label: "Building blocks", type: "REPEAT", rowLabel: "Block", minRows: 1, maxRows: 4, fields: [{ key: "bname", label: "Block name", type: "TEXT", required: true }, { key: "cond", label: "Condition", type: "SELECT", options: [{ value: "good", label: "Good" }, { value: "poor", label: "Poor" }] }] },
  { key: "sign", label: "Signature of the in-charge", type: "SIGNATURE", signer: "In-charge" },
];
const places = [
  { id: "f1", name: "BHU Sheringal", path: "Upper Dir", facility: true }, { id: "f2", name: "RHC Dir", path: "Upper Dir", facility: true },
  { id: "f3", name: "Zed Clinic", path: "Mardan", facility: true }, { id: "v1", name: "Village", path: "Mardan", facility: false },
];

function Host() {
  return (
    <div data-testid="host" className="mx-auto max-w-5xl p-4">
      <AssessmentFlow
        form={{ id: "form1", name: "Facility check", fields: fields as never, definition: definition as never }}
        places={places}
        assignments={[{ placeId: "f2", status: "TO_DO", dueOn: "2026-12-01" }]}
        drafts={w.__h.draftStore}
        online
        rememberKey="harness"
        prefill={async (placeId) => (placeId === "f2" ? { values: { year: 1990 }, carried: ["year"] } : null)}
        uploadFile={async (file) => { w.__h.calls.push(["upload", [file.name, file.type, file.size]]); return { ok: true, id: "file-id-00001", name: file.name }; }}
        onNotVisited={async (placeId, reason) => { w.__h.calls.push(["notVisited", [placeId, reason]]); return { ok: true }; }}
        onSubmit={async (input) => { w.__h.calls.push(["submit", [input]]); return { ok: true }; }}
      />
    </div>
  );
}

const messages = lang === "en" ? undefined : MESSAGES[lang];
createRoot(document.getElementById("root")!).render(<I18nProvider initialLocale={lang} {...(messages ? { initialMessages: messages } : {})}><Host /></I18nProvider>);
