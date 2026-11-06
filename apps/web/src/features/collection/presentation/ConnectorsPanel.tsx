"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteConnectorAction, listConnectorsAction, saveConnectorAction, syncConnectorAction } from "@/lib/actions/collection";
import { useActionState } from "@/lib/client/action-state";
import type { CollectionFormView, ConnectorView, SyncResultView } from "@/lib/server/schemas-collection";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const SERVER_HINT = { KOBOTOOLBOX: "https://kf.kobotoolbox.org", SURVEYCTO: "https://yourteam.surveycto.com" } as const;
const ID_LABEL = { KOBOTOOLBOX: "The form's id (the code at the end of its address in KoboToolbox)", SURVEYCTO: "The form's id in SurveyCTO" } as const;
const KEY_LABEL = { KOBOTOOLBOX: "API token (from your KoboToolbox account settings)", SURVEYCTO: "User name and password, written user:password" } as const;

/** Bring submissions from KoboToolbox or SurveyCTO into this form as records waiting for review. */
export function ConnectorsPanel({ form }: { form: CollectionFormView }) {
  const [list, setList] = useState<{ connectors: ConnectorView[]; available: boolean } | null>(null);
  const [editing, setEditing] = useState<ConnectorView | "new" | null>(null);
  const [result, setResult] = useState<{ id: string; r: SyncResultView } | null>(null);
  const act = useActionState();
  const load = useCallback(async () => { const r = await listConnectorsAction(form.id); setList(r.ok ? r.value : { connectors: [], available: false }); }, [form.id]);
  useEffect(() => { void load(); }, [load]);

  async function run(id: string, apply: boolean) {
    setResult(null);
    const r = await act.run(() => syncConnectorAction(id, { apply }));
    if (r && typeof r === "object") setResult({ id, r });
    if (apply) await load();
  }
  async function remove(c: ConnectorView) {
    if (!window.confirm(`Remove the connection "${c.name}"? Records already brought in stay.`)) return;
    if (await act.run(() => deleteConnectorAction(c.id))) await load();
  }

  if (list === null) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">If your team already collects in KoboToolbox or SurveyCTO, DonorDesk can bring those submissions in. They arrive as records waiting for review, after this form&apos;s own rules have checked them. Bringing the same submission in twice stores it once. Photos and files are not brought in.</p>
      {!list.available && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-500/10">Connections are not set up on this server yet, so a key cannot be kept safely. Ask whoever runs DonorDesk to set them up.</p>}
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}

      <ul className="space-y-3">
        {list.connectors.map((c) => {
          const last = c.lastSync as { read?: number; created?: number; rejected?: number; error?: string } | undefined;
          return (
            <li key={c.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{c.name} <span className="text-xs font-normal text-slate-500">· {c.kindLabel}</span></p>
                  <p className="text-xs text-slate-500">{c.serverUrl} · {c.sourceId}{c.lastSyncAt ? ` · last synced ${c.lastSyncAt.slice(0, 16).replace("T", " ")}` : " · never synced"}</p>
                  {last?.error ? <p className="text-xs text-danger-600">Last attempt: {last.error}</p> : last ? <p className="text-xs text-slate-500">Last time: {last.read ?? 0} read, {last.created ?? 0} new, {last.rejected ?? 0} not accepted.</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void run(c.id, false)} disabled={act.busy}>Check the connection</Button>
                  <Button onClick={() => void run(c.id, true)} pending={act.busy} disabled={act.busy || form.status !== "PUBLISHED"}>Bring in new submissions</Button>
                  <Button variant="secondary" onClick={() => setEditing(c)} disabled={act.busy}>Edit</Button>
                  <Button variant="secondary" onClick={() => void remove(c)} disabled={act.busy}>Remove</Button>
                </div>
              </div>
              {result?.id === c.id && <SyncReport r={result.r} />}
            </li>
          );
        })}
      </ul>
      {form.status !== "PUBLISHED" && <p className="text-xs text-slate-500">Publish the form to bring submissions in. You can check a connection before that.</p>}

      {editing ? <ConnectorForm form={form} connector={editing === "new" ? null : editing} available={list.available} onDone={async () => { setEditing(null); await load(); }} onCancel={() => setEditing(null)} /> : (
        <Button variant="secondary" onClick={() => setEditing("new")} disabled={!list.available}>Connect KoboToolbox or SurveyCTO</Button>
      )}
    </div>
  );
}

function SyncReport({ r }: { r: SyncResultView }) {
  return (
    <div role="status" className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm dark:bg-white/5">
      <p>{r.applied ? "Done." : "Checked; nothing was saved."} Read {r.read} submission{r.read === 1 ? "" : "s"}: {r.created} {r.applied ? "brought in" : "would be new"}, {r.alreadyHad} already here, {r.rejected} not accepted{r.skipped ? `, ${r.skipped} without an id or time were skipped` : ""}.</p>
      {r.more && <p>There are more waiting than one go reads. Bring in new submissions again to continue.</p>}
      {r.problems.length > 0 && (
        <div>
          <p className="font-medium">Not accepted</p>
          <ul className="list-disc ps-5">{r.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
          <p className="text-xs text-slate-500">Fix the field names below and bring in again: these are tried again next time.</p>
        </div>
      )}
    </div>
  );
}

function ConnectorForm({ form, connector, available, onDone, onCancel }: { form: CollectionFormView; connector: ConnectorView | null; available: boolean; onDone: () => Promise<void>; onCancel: () => void }) {
  const act = useActionState();
  const [name, setName] = useState(connector?.name ?? "");
  const [kind, setKind] = useState<ConnectorView["kind"]>(connector?.kind ?? "KOBOTOOLBOX");
  const [serverUrl, setServerUrl] = useState(connector?.serverUrl ?? SERVER_HINT.KOBOTOOLBOX);
  const [sourceId, setSourceId] = useState(connector?.sourceId ?? "");
  const [credential, setCredential] = useState("");
  const questions = form.fields.filter((f) => f.type !== "FILE");
  const [map, setMap] = useState<Record<string, string>>(() => Object.fromEntries((connector?.fieldMap ?? []).map((m) => [m.formKey, m.sourceField])));

  async function save() {
    const fieldMap = questions.filter((q) => (map[q.key] ?? "").trim() !== "").map((q) => ({ formKey: q.key, sourceField: map[q.key]!.trim() }));
    const r = await act.run(() => saveConnectorAction(form.id, { name, kind, serverUrl, sourceId, ...(credential ? { credential } : {}), fieldMap }, connector?.id));
    if (r) await onDone();
  }

  return (
    <section className="space-y-3 rounded-lg border border-brand-400 p-3" aria-label="Connection">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="A name for this connection"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <Field label="The tool">
          <Select value={kind} onChange={(e) => { const k = e.target.value as typeof kind; setKind(k); if (!connector) setServerUrl(SERVER_HINT[k]); }}>
            <option value="KOBOTOOLBOX">KoboToolbox</option>
            <option value="SURVEYCTO">SurveyCTO</option>
          </Select>
        </Field>
        <Field label="Server address" description="It must start with https://"><Input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} /></Field>
        <Field label={ID_LABEL[kind]}><Input value={sourceId} onChange={(e) => setSourceId(e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <Field label={KEY_LABEL[kind]} description={connector ? "Leave empty to keep the one already saved. It is never shown again." : "It is kept encrypted and never shown again."}>
            <Input type="password" autoComplete="off" value={credential} onChange={(e) => setCredential(e.target.value)} />
          </Field>
        </div>
      </div>
      <div>
        <p className="label">Which field of the other tool answers each question</p>
        <p className="mb-2 text-xs text-slate-500">Write the field&apos;s name as it is in {kind === "KOBOTOOLBOX" ? "KoboToolbox" : "SurveyCTO"}. Leave a question empty if nothing answers it. Questions marked * must be answered.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {questions.map((q) => (
            <Field key={q.key} label={`${q.label}${q.required ? " *" : ""}`}>
              <Input value={map[q.key] ?? ""} onChange={(e) => setMap((m) => ({ ...m, [q.key]: e.target.value }))} />
            </Field>
          ))}
        </div>
      </div>
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      <div className="flex gap-2">
        <Button onClick={() => void save()} pending={act.busy} disabled={act.busy || !available || !name.trim() || !sourceId.trim() || (!connector && !credential)}>Save the connection</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </section>
  );
}
