"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/feedback/Dialog";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { AssetThumb } from "./primitives";
import { readFileAsBase64, studio, type AssetItem } from "../../domain/studio-api";

/**
 * The organization's picture library (Phase 32.3). Pictures are uploaded here on purpose and re-encoded by the server
 * (size bounded, camera and location data removed); nothing is taken from evidence files. Choosing one hands its id back.
 */
export function AssetLibrary({ open, onClose, kind, onChoose, canEdit }: { open: boolean; onClose: () => void; kind: "IMAGE" | "LOGO"; onChoose?: (asset: AssetItem) => void; canEdit: boolean }) {
  const [items, setItems] = useState<AssetItem[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [credit, setCredit] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (): Promise<void> => {
    const r = await studio<{ items: AssetItem[] }>("infographic-assets");
    if (r.ok) setItems(r.data.items);
    else setError(r.message);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const upload = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const dataBase64 = await readFileAsBase64(file);
      const r = await studio<AssetItem>("infographic-assets", { method: "POST", body: { name: name.trim() || file.name.replace(/\.[^.]+$/, ""), kind, ...(credit.trim() ? { credit: credit.trim() } : {}), dataBase64 } });
      if (r.ok) {
        setName("");
        setCredit("");
        if (fileRef.current) fileRef.current.value = "";
        await load();
      } else setError(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (asset: AssetItem): Promise<void> => {
    const r = await studio(`infographic-assets/${asset.id}`, { method: "DELETE" });
    if (r.ok) await load();
    else setError(r.message);
  };

  const shown = (items ?? []).filter((a) => a.kind === kind);
  return (
    <Dialog open={open} onClose={onClose} title={kind === "LOGO" ? "Logos" : "Pictures"} size="lg">
      <div className="space-y-4">
        {canEdit && (
          <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="Borehole in Gulu" />
              </Field>
              <Field label={kind === "LOGO" ? "Owner" : "Photo credit"} hint="Shown under the picture when you use it.">
                <Input value={credit} maxLength={80} onChange={(event) => setCredit(event.target.value)} />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" aria-label="Choose a picture" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} className="text-sm" />
              {busy && <span className="text-sm text-slate-500">Uploading…</span>}
            </div>
            <p className="mt-2 text-xs text-slate-500">PNG or JPEG, up to 6 MB. The picture is resized and its camera and location data is removed. Only upload pictures you may use, and only show people who agreed to appear.</p>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {items === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-500">{kind === "LOGO" ? "No logos yet." : "No pictures yet."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((asset) => (
              <li key={asset.id} className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                <AssetThumb id={asset.id} alt={asset.name} className="h-28 w-full" />
                <div className="space-y-1 p-2 text-xs">
                  <p className="truncate font-medium" title={asset.name}>
                    {asset.name}
                  </p>
                  <div className="flex gap-2">
                    {onChoose && (
                      <Button size="sm" onClick={() => onChoose(asset)}>
                        Use
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => void remove(asset)} aria-label={`Remove ${asset.name}`}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
