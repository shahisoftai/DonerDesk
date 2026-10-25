"use client";

import { useState } from "react";
import { Dialog } from "@/components/feedback/Dialog";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { studio } from "../../domain/studio-api";

/** Keeps this design's layout (blocks, widths, look) as the organization's own starting point; none of its figures or filters come along. */
export function SaveTemplateDialog({ open, onClose, designId, defaultName }: { open: boolean; onClose: () => void; designId: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    const r = await studio("infographic-templates", { method: "POST", body: { name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}), infographicId: designId } });
    setBusy(false);
    if (r.ok) setDone(true);
    else setError(r.message);
  };

  return (
    <Dialog open={open} onClose={() => (setDone(false), onClose())} title="Save this layout for reuse">
      {done ? (
        <div className="space-y-3 text-sm">
          <p role="status" className="text-green-700">Saved. It appears under “My layouts” when you start a new infographic.</p>
          <div className="flex justify-end">
            <Button onClick={() => (setDone(false), onClose())}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600 dark:text-slate-300">The blocks, their widths and the look are kept. The title, the periods, the locations, the pictures and the indicators you picked are not.</p>
          <Field label="Name">
            <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="What it is good for (optional)">
            <Input value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button pending={busy} disabled={!name.trim()} onClick={() => void save()}>
              Save layout
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
