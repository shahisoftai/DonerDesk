"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "@/lib/client/action-state";
import { createApiKeyAction, createWebhookAction, deleteWebhookAction, listWebhookDeliveriesAction, revokeApiKeyAction, setWebhookEnabledAction } from "@/lib/actions/integrations";
import type { ApiKeyItem, WebhookDeliveryItem, WebhookItem } from "@/lib/server/schemas-integrations";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { INTEGRATIONS_COPY as C, SCOPE_LABEL, WEBHOOK_EVENT_LABEL, WEBHOOK_EVENTS_LIVE } from "../domain/integrations-copy";

const STATUS_LABEL: Record<ApiKeyItem["status"], string> = { ACTIVE: C.statusActive, REVOKED: C.statusRevoked, EXPIRED: C.statusExpired };
const day = (iso: string) => iso.slice(0, 10);

/** API keys and webhooks. A secret is shown once, in the box that appears when it is created, and never again. */
export function IntegrationsPanel({ keys, webhooks }: { keys: ApiKeyItem[]; webhooks: WebhookItem[] }) {
  const router = useRouter();
  const keyAction = useActionState();
  const hookAction = useActionState();
  const rowAction = useActionState();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["projects:read", "indicators:read"]);
  const [days, setDays] = useState("");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["report.approved"]);
  const [shownSecret, setShownSecret] = useState<string | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [log, setLog] = useState<WebhookDeliveryItem[]>([]);
  const busy = keyAction.busy || hookAction.busy || rowAction.busy;

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    const out = await keyAction.run(() => createApiKeyAction({ name, scopes, ...(days ? { expiresInDays: Number(days) } : {}) }));
    if (out) { setShownKey(out.token); setName(""); router.refresh(); }
  }
  async function createHook(event: React.FormEvent) {
    event.preventDefault();
    const out = await hookAction.run(() => createWebhookAction({ url, events }));
    if (out) { setShownSecret(out.secret); setUrl(""); router.refresh(); }
  }
  async function act(work: () => Promise<{ ok: boolean } & Record<string, unknown>>) {
    const out = await rowAction.run(work as never);
    if (out) router.refresh();
  }
  async function showLog(id: string) {
    if (openLog === id) { setOpenLog(null); return; }
    const out = await rowAction.run(() => listWebhookDeliveriesAction(id));
    if (out && typeof out === "object") { setLog(out.deliveries); setOpenLog(id); }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="card" aria-labelledby="keys-title">
        <h2 id="keys-title" className="text-sm font-semibold">{C.keysTitle}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{C.keysIntro}</p>
        {shownKey && (
          <div role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-400/40 dark:bg-amber-500/10">
            <p className="font-medium">{C.copyNow}</p>
            <code className="mt-2 block break-all rounded bg-white p-2 text-xs dark:bg-slate-900">{shownKey}</code>
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => setShownKey(null)}>OK</Button>
          </div>
        )}
        <form onSubmit={createKey} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={C.keyName} description={C.keyNameHint} error={keyAction.fields?.name?.[0]}>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </Field>
          <Field label={C.expires}>
            <Select value={days} onChange={(e) => setDays(e.target.value)} disabled={busy}>
              <option value="">{C.expiresNever}</option>
              {[30, 90, 365].map((n) => <option key={n} value={n}>{C.expiresDays(n)}</option>)}
            </Select>
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="label">{C.scopes}</legend>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              {Object.entries(SCOPE_LABEL).map(([id, label]) => (
                <label key={id} className="flex items-center gap-2"><input type="checkbox" checked={scopes.includes(id)} onChange={() => toggle(scopes, setScopes, id)} disabled={busy} />{label}</label>
              ))}
            </div>
            {keyAction.fields?.scopes?.[0] && <p className="mt-1 text-xs text-danger-600">{keyAction.fields.scopes[0]}</p>}
          </fieldset>
          <p className="text-xs text-slate-500 sm:col-span-2">{C.projects}: {C.projectsAll}</p>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || name.trim() === "" || scopes.length === 0}>{keyAction.busy ? C.creating : C.createKey}</Button>
            {keyAction.error && <p role="alert" className="mt-2 text-sm text-danger-600">{keyAction.error}</p>}
          </div>
        </form>
        {keys.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{C.noKeys}</p> : (
          <ul className="mt-4 divide-y divide-slate-200 text-sm dark:divide-white/10">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-medium">{k.name}</span> <code className="text-xs text-slate-500">{k.prefix}…</code>
                  <p className="text-xs text-slate-500">{STATUS_LABEL[k.status]} · {k.scopes.map((s) => SCOPE_LABEL[s] ?? s).join(", ")} · {k.lastUsedAt ? C.lastUsed(day(k.lastUsedAt)) : C.neverUsed}</p>
                </div>
                {k.status === "ACTIVE" && <button type="button" className="text-xs font-medium text-danger-600 hover:underline disabled:opacity-50" disabled={busy} onClick={() => act(() => revokeApiKeyAction(k.id) as never)}>{C.revoke}</button>}
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium">{C.howToTitle}</summary>
          <p className="mt-1 text-slate-600 dark:text-slate-300">{C.howTo}</p>
        </details>
      </section>

      <section className="card" aria-labelledby="hooks-title">
        <h2 id="hooks-title" className="text-sm font-semibold">{C.webhooksTitle}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{C.webhooksIntro}</p>
        {shownSecret && (
          <div role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-400/40 dark:bg-amber-500/10">
            <p className="font-medium">{C.secretNow}</p>
            <code className="mt-2 block break-all rounded bg-white p-2 text-xs dark:bg-slate-900">{shownSecret}</code>
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => setShownSecret(null)}>OK</Button>
          </div>
        )}
        <form onSubmit={createHook} className="mt-3 space-y-3">
          <Field label={C.url} description={C.urlHint} error={hookAction.fields?.url?.[0]}>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} inputMode="url" />
          </Field>
          <fieldset>
            <legend className="label">{C.events}</legend>
            <div className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
              {Object.entries(WEBHOOK_EVENT_LABEL).map(([id, label]) => (
                <label key={id} className="flex items-center gap-2">
                  <input type="checkbox" checked={events.includes(id)} onChange={() => toggle(events, setEvents, id)} disabled={busy} />
                  {label}{WEBHOOK_EVENTS_LIVE.has(id) ? "" : " (coming soon)"}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" disabled={busy || url.trim() === "" || events.length === 0}>{C.addWebhook}</Button>
          {hookAction.error && <p role="alert" className="text-sm text-danger-600">{hookAction.error}</p>}
        </form>
        {webhooks.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{C.noWebhooks}</p> : (
          <ul className="mt-4 divide-y divide-slate-200 text-sm dark:divide-white/10">
            {webhooks.map((w) => (
              <li key={w.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="break-all font-medium">{w.url}</span>
                    <p className="text-xs text-slate-500">{w.enabled ? C.on : C.off} · {w.events.map((e) => WEBHOOK_EVENT_LABEL[e] ?? e).join(", ")}</p>
                    {w.disabledReason && <p className="text-xs text-amber-700 dark:text-amber-300">{w.disabledReason}</p>}
                  </div>
                  <div className="flex gap-3 text-xs font-medium">
                    <button type="button" className="text-brand-700 hover:underline dark:text-brand-300" disabled={busy} onClick={() => showLog(w.id)}>{C.deliveries}</button>
                    {!w.enabled && <button type="button" className="text-brand-700 hover:underline dark:text-brand-300" disabled={busy} onClick={() => act(() => setWebhookEnabledAction(w.id, true) as never)}>{C.switchOn}</button>}
                    <button type="button" className="text-danger-600 hover:underline" disabled={busy} onClick={() => act(() => deleteWebhookAction(w.id) as never)}>{C.remove}</button>
                  </div>
                </div>
                {openLog === w.id && (
                  <ul className="mt-2 rounded bg-slate-50 p-2 text-xs dark:bg-white/5">
                    {log.length === 0 ? <li>{C.deliveryNone}</li> : log.map((d) => (
                      <li key={d.id}>{day(d.createdAt)} · {WEBHOOK_EVENT_LABEL[d.event] ?? d.event} · {C.deliveryStatus[d.status] ?? d.status}{d.error ? ` — ${d.error}` : ""}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        {rowAction.error && <p role="alert" className="mt-2 text-sm text-danger-600">{rowAction.error}</p>}
      </section>
    </div>
  );
}
