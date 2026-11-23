"use client";

import { useEffect, useState } from "react";
import { OutboxProvider } from "./OutboxProvider";
import { FieldShell } from "./field/FieldShell";
import { IDENTITY_KEY } from "./field/useFieldPacks";

function rememberedUser(): string {
  try { return localStorage.getItem(IDENTITY_KEY) ?? ""; } catch { return ""; }
}

/**
 * The field app: forms filled on a phone with or without a connection. It shows only what is stored on this device (work the
 * signed-in person downloaded earlier), so the page itself holds no private data and may be kept for offline opening. The outbox is
 * the device's: it is scoped to whoever last downloaded their work here; with none, there is nothing to send yet.
 */
export function FieldApp() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { setUserId(rememberedUser()); }, []);
  if (userId === null) return <p className="p-6 text-center text-slate-500">…</p>;
  return (
    <div data-tour-id="field-app">
      <OutboxProvider scope={userId || "nobody"}>
        <FieldShell userId={userId} onUser={setUserId} />
      </OutboxProvider>
    </div>
  );
}
