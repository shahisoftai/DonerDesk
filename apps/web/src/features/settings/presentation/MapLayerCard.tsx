"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "@/lib/client/action-state";
import { removeMapLayerAction, uploadMapLayerAction } from "@/lib/actions/org";
import type { MapLayerMeta } from "@/lib/server/schemas";
import { Button } from "@/components/ui/Button";

const MB = 1024 * 1024;

/**
 * The workspace's own map boundaries (Phase 30.1): one GeoJSON layer the site maps draw instead of
 * the bundled country and province outlines — how district and sub-district polygons get in. One
 * layer per workspace; a new upload replaces it. Administrators only (the settings page gates this).
 */
export function MapLayerCard({ layer }: { layer: MapLayerMeta | null }) {
  const router = useRouter();
  const upload = useActionState();
  const removeState = useActionState();
  const busy = upload.busy || removeState.busy;
  const error = upload.error ?? removeState.error;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const out = await upload.run(() => uploadMapLayerAction(new FormData(form)));
    if (out) {
      form.reset();
      router.refresh();
    }
  }

  async function remove() {
    const out = await removeState.run(() => removeMapLayerAction());
    if (out) router.refresh();
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Custom map boundaries</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Upload your own boundaries — districts, sub-districts, project zones — as one GeoJSON file (up to 12 MB).
        Every map in the workspace then draws your boundaries instead of the built-in country and province outlines.
      </p>
      {layer ? (
        <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
          <p className="font-medium text-slate-800 dark:text-slate-100">{layer.name}</p>
          <p className="mt-0.5 text-slate-600 dark:text-slate-300">
            {layer.featureCount} boundaries · {(layer.sizeBytes / MB).toFixed(2)} MB
          </p>
          <button type="button" className="mt-2 text-sm font-medium text-red-600 hover:underline dark:text-red-400" disabled={busy} onClick={remove}>
            Remove the uploaded boundaries
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No custom boundaries uploaded — maps use the built-in world and province outlines.</p>
      )}
      <form onSubmit={submit} className="mt-3 space-y-2">
        <input
          type="file"
          name="file"
          accept=".json,.geojson,application/geo+json,application/json"
          className="block w-full text-sm text-slate-700 dark:text-slate-200"
          disabled={busy}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Uploading…" : layer ? "Replace with a new file" : "Upload boundaries"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
