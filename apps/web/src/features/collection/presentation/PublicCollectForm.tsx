"use client";

import { useRef } from "react";
import type { FormField } from "@donordesk/domain/contexts/collection/index.js";
import { newIdempotencyKey } from "@/lib/shared/create-retry";
import { FormFiller } from "./FormFiller";

/** The public form. Each answer carries its own id, kept until it is sent, so a repeated send after a bad connection is stored once. */
export function PublicCollectForm({ token, fields }: { token: string; fields: ReadonlyArray<FormField> }) {
  const key = useRef(newIdempotencyKey());
  return (
    <FormFiller
      fields={fields}
      withName
      submitLabel="Send my answers"
      onSubmit={async (answers, submitterName) => {
        try {
          const id = key.current.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60).padEnd(8, "0");
          const response = await fetch(`/api/collect/${encodeURIComponent(token)}`, {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, answers, ...(submitterName ? { submitterName } : {}) }),
          });
          if (response.ok) { key.current = newIdempotencyKey(); return { ok: true }; }
          if (response.status === 404) return { ok: false, message: "This link is no longer available." };
          const problem = (await response.json().catch(() => null)) as { title?: string; detail?: string } | null;
          return { ok: false, message: problem?.detail ?? problem?.title ?? "That could not be sent. Check your answers and try again." };
        } catch {
          return { ok: false, message: "No connection. Your answers are still here; try again when you are online." };
        }
      }}
    />
  );
}
