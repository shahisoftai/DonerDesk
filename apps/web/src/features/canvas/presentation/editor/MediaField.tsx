"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetItem } from "@/features/infographics/domain/studio-api";
import { assetUrl, listPictures, MEDIA_ACCEPT, uploadPicture } from "../../domain/media";

interface Props { label: string; value: string | undefined; onChange: (assetId: string | undefined, asset?: AssetItem) => void }

/** Choose a picture from the organisation's library or upload a new one (stored in the organisation's Google Drive). The id is never typed by hand. */
export function MediaField({ label, value, onChange }: Props) {
  const [items, setItems] = useState<AssetItem[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { const r = await listPictures(); if (r.ok) setItems(r.items); else setMessage(r.message); }, []);
  useEffect(() => { void load(); }, [load]);
  async function upload(f: File | undefined): Promise<void> {
    if (!f) return;
    setBusy(true); setMessage(null);
    const r = await uploadPicture(f);
    setBusy(false);
    if (file.current) file.current.value = "";
    if (!r.ok) { setMessage(r.message); return; }
    await load();
    onChange(r.asset.id, r.asset);
  }
  return (
    <div className="space-y-2" data-testid="media-field">
      <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <label className="inline-flex min-h-8 cursor-pointer items-center rounded border border-slate-300 px-2 py-1 text-xs hover:border-brand-500 dark:border-slate-600">
        <input ref={file} type="file" accept={MEDIA_ACCEPT} className="sr-only" aria-label="Upload a picture" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} data-testid="media-upload" />
        {busy ? "Uploading…" : "Upload a picture"}
      </label>
      {message && <p role="alert" className="text-xs text-red-700">{message}</p>}
      {items && items.length === 0 && <p className="text-xs text-slate-500">No pictures yet. Upload one; it is kept in your Google Drive.</p>}
      <ul className="grid max-h-48 grid-cols-3 gap-1 overflow-y-auto">
        {(items ?? []).map((a) => (
          <li key={a.id}>
            <button type="button" aria-pressed={value === a.id} title={a.name} onClick={() => onChange(a.id, a)} className={`block w-full overflow-hidden rounded border ${value === a.id ? "border-brand-600 ring-2 ring-brand-500" : "border-slate-200 dark:border-slate-700"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl(a.id)} alt={a.name} className="h-14 w-full bg-slate-100 object-contain" />
            </button>
          </li>
        ))}
      </ul>
      {value && <button type="button" className="text-xs text-slate-500 underline" onClick={() => onChange(undefined)}>Remove the picture</button>}
    </div>
  );
}
