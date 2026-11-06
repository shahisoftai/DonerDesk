"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadOfflinePackAction, listFieldProjectsAction } from "@/lib/actions/offline";
import { newIdempotencyKey } from "@/lib/shared/create-retry";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { FormFiller } from "@/features/collection/presentation/FormFiller";
import { createMemoryPackStore, describePackFreshness, packCanRecordNumbers, packCounts, packsFor, type OfflinePack, type PackStore } from "../domain/offline-pack";
import { COLLECTION_RECORD_KIND, collectionRecordEntry, type QueuedAttachment } from "../domain/collection-outbox";
import { canUseDurableOutbox } from "../infrastructure/indexeddb-outbox-store";
import { createIndexedDbPackStore } from "../infrastructure/indexeddb-pack-store";
import { OutboxProvider, useOutbox } from "./OutboxProvider";
import { OutboxBanner } from "./OutboxBanner";
import { usePackRecordDeps } from "@/features/record/composition";
import { RecordSheetBody } from "@/features/record/presentation/RecordSheetBody";
import { WaitingList } from "@/features/record/presentation/WaitingList";
import type { RecordKind } from "@/features/record/domain/record-kinds";
import type { Capability } from "@/lib/shared/capabilities";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { LocaleSwitcher } from "@/features/i18n/presentation/LocaleSwitcher";

const IDENTITY_KEY = "donordesk-field-user";

/** A pack is only made for someone who may record numbers; activities are offered too, and the server still checks each record on send. */
const PACK_CAPABILITIES: readonly Capability[] = ["indicator.update", "activity.create"];
/** Offline, only what works with no signal is offered; filling a form has its own list below. */
const OFFLINE_KINDS = (kind: RecordKind) => kind.offline !== "ONLINE_ONLY" && kind.key !== "FORM";

/** The same Record screens as the signed-in app, fed from the packs on this phone, so a number or an activity can be recorded with no signal. */
function RecordPanel({ packs }: { packs: OfflinePack[] }) {
  const deps = usePackRecordDeps(packs);
  const { t } = useI18n();
  const [session, setSession] = useState(0);
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40" aria-label={t("record.sheet.title")}>
      <h2 className="text-lg font-bold">{t("record.sheet.title")}</h2>
      <RecordSheetBody key={session} deps={deps} capabilities={PACK_CAPABILITIES} request={{}} kindFilter={OFFLINE_KINDS} onClose={() => setSession((n) => n + 1)} />
    </section>
  );
}

function rememberedUser(): string {
  try { return localStorage.getItem(IDENTITY_KEY) ?? ""; } catch { return ""; }
}

/**
 * The field app: forms filled on a phone with or without a connection. It shows only what is stored on this device (packs the
 * signed-in person downloaded earlier), so the page itself holds no private data and may be kept for offline opening.
 */
export function FieldApp() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { setUserId(rememberedUser()); }, []);
  if (userId === null) return <p className="p-4 text-sm text-slate-500">Loading…</p>;
  // The outbox is the device's: it is scoped to whoever last downloaded a pack here; with none, there is nothing to send yet.
  return (
    <OutboxProvider scope={userId || "nobody"}>
      <FieldScreens userId={userId} onUser={setUserId} />
    </OutboxProvider>
  );
}

function FieldScreens({ userId, onUser }: { userId: string; onUser: (id: string) => void }) {
  const { t, tp } = useI18n();
  const store = useMemo<PackStore>(() => (canUseDurableOutbox() ? createIndexedDbPackStore(indexedDB) : createMemoryPackStore()), []);
  const outbox = useOutbox();
  const [packs, setPacks] = useState<OfflinePack[] | null>(null);
  const [active, setActive] = useState<{ pack: OfflinePack; formId: string } | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }> | null>(null);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => setPacks(packsFor(await store.list().catch(() => []), userId)), [store, userId]);
  useEffect(() => { void load(); }, [load]);

  // Online: offer the person's projects. Offline this simply stays empty and the downloaded packs are all there is.
  useEffect(() => {
    if (!outbox.online) return;
    void listFieldProjectsAction().then((r) => {
      if (!r.ok) return;
      setProjects(r.value.projects);
      if (r.value.userId && r.value.userId !== userId) onUser(r.value.userId);
    }).catch(() => undefined);
  }, [outbox.online, userId, onUser]);

  async function download() {
    const project = projects?.find((p) => p.id === projectId);
    if (!project) return;
    setBusy(true); setMessage(null);
    try {
      const r = await downloadOfflinePackAction(project.id, project.name);
      if (!r.ok) { setMessage(r.error.message); return; }
      await store.put(r.value);
      try { localStorage.setItem(IDENTITY_KEY, r.value.userId); } catch { /* the pack still works this visit */ }
      if (r.value.userId !== userId) onUser(r.value.userId);
      setMessage(r.value.forms.length === 0 ? t("field.downloadedNone") : tp("field.downloaded", r.value.forms.length));
      await load();
    } finally { setBusy(false); }
  }

  async function remove(id: string) { await store.remove(id); setActive(null); await load(); }

  const form = active ? active.pack.forms.find((f) => f.id === active.formId) : undefined;

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{t("field.title")}</h1>
          <LocaleSwitcher />
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{outbox.online ? t("field.online") : t("field.offline")}</p>
      </header>
      <OutboxBanner />

      {!active && packs && packs.length > 0 && <RecordPanel packs={packs} />}

      {active && form ? (
        <section className="space-y-3">
          <button className="text-sm underline" onClick={() => setActive(null)}>{t("field.allForms")}</button>
          <h2 className="text-lg font-semibold">{form.name}</h2>
          {form.description && <p className="text-sm text-slate-600 dark:text-slate-300">{form.description}</p>}
          <QueueingFiller key={active.formId} pack={active.pack} formId={form.id} formName={form.name} fields={form.fields} />
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("field.onThisPhone")}</h2>
            {packs === null ? <p className="text-sm text-slate-500">{t("common.loading")}</p> : packs.length === 0 ? (
              <p className="text-sm text-slate-500">{t("field.nothingDownloaded")}</p>
            ) : packs.map((pack) => {
              const fresh = describePackFreshness(pack, now);
              return (
                <div key={pack.projectId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="font-medium">{pack.projectName}</p>
                  <p className={`text-xs ${fresh.stale ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}`}>{fresh.stale ? t("pack.stale", { count: fresh.days }) : fresh.days === 0 ? t("pack.today") : tp("pack.days", fresh.days)}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t("record.ready.counts", packCounts(pack))}</p>
                  {!packCanRecordNumbers(pack) && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">{t("record.ready.updateForNumbers")}</p>}
                  <ul className="mt-2 space-y-1">
                    {pack.forms.length === 0 && <li className="text-sm text-slate-500">{t("field.noFormOpen")}</li>}
                    {pack.forms.map((f) => (
                      <li key={f.id}><button className="text-start text-sm underline" onClick={() => setActive({ pack, formId: f.id })}>{f.name}</button></li>
                    ))}
                  </ul>
                  <button className="mt-2 text-xs text-slate-500 underline" onClick={() => void remove(pack.projectId)}>{t("field.remove")}</button>
                </div>
              );
            })}
          </section>

          <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h2 className="text-base font-semibold">{t("field.downloadTitle")}</h2>
            {!outbox.online ? <p className="text-sm text-slate-500">{t("field.connectToDownload")}</p> : projects === null ? <p className="text-sm text-slate-500">{t("field.loadingProjects")}</p> : (
              <>
                <Field label={t("field.project")}><Select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">{t("field.chooseProject")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
                <Button onClick={() => void download()} pending={busy} disabled={!projectId || busy}>{t("field.downloadButton")}</Button>
              </>
            )}
            {message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
            <p className="text-xs text-slate-500">{t("field.whatKept")}</p>
          </section>
        </>
      )}

      {!active && (
        <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h2 className="text-base font-semibold">{t("record.waiting.title")}</h2>
          <WaitingList />
        </section>
      )}
    </main>
  );
}

/** Fills a form and puts the finished one in the outbox; the outbox sends it now if online, or whenever the connection returns. */
function QueueingFiller({ pack, formId, formName, fields }: { pack: OfflinePack; formId: string; formName: string; fields: OfflinePack["forms"][number]["fields"] }) {
  const outbox = useOutbox();
  const { t } = useI18n();
  const [files, setFiles] = useState<Record<string, QueuedAttachment>>({});
  const placeNames = useMemo(() => pack.places.map((p) => {
    const parts = p.path.split(" › ");
    return parts.length > 1 ? `${p.name}, ${parts[1]}` : p.name;
  }), [pack.places]);
  const [key, setKey] = useState(0);

  return (
    <FormFiller
      key={key}
      fields={fields}
      placeNames={placeNames}
      submitLabel={outbox.online ? t("common.send") : t("common.saveOnPhone")}
      // A photo stays on the phone with the record and goes up with it; its key here is a placeholder the outbox replaces.
      uploadFile={async (file, fieldKey) => {
        if (file.size > 5 * 1024 * 1024) return { ok: false, message: t("form.fileTooBig") };
        const token = newIdempotencyKey().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24).padEnd(8, "0");
        setFiles((current) => ({ ...current, [fieldKey]: { fieldKey, name: file.name, type: file.type, blob: file } }));
        return { ok: true, id: token, name: file.name };
      }}
      onSubmit={async (answers) => {
        if (!outbox.supported) return { ok: false, message: t("field.cannotKeep") };
        const attached = fields.filter((f) => f.type === "FILE" && files[f.key]);
        const plain = { ...answers };
        for (const f of attached) delete plain[f.key];
        const id = newIdempotencyKey().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60).padEnd(8, "0");
        await outbox.enqueue(collectionRecordEntry({ id, title: formName, payload: { formId, answers: plain, files: attached.map((f) => files[f.key]!) }, now: Date.now() }));
        setFiles({});
        setKey((k) => k + 1);
        void outbox.sendNow();
        return { ok: true };
      }}
    />
  );
}
