"use client";

import { useRef, type ReactNode } from "react";
import { wipeOfflinePacks } from "../infrastructure/indexeddb-pack-store";
import { wipeOfflineMaps } from "../infrastructure/offline-maps";
import { wipeAssessmentDrafts } from "@/features/collection/adapters/indexeddb-draft-store";

/** Signing out removes the offline packs and any assessment drafts from this phone first, so the next person to use it finds none of the last person's. */
export function SignOutForm({ action, children, className }: { action: () => Promise<void>; children: ReactNode; className?: string }) {
  const wiped = useRef(false);
  return (
    <form
      action={action}
      className={className}
      onSubmit={async (e) => {
        if (wiped.current) return;
        e.preventDefault();
        const form = e.currentTarget;
        await wipeOfflinePacks();
        await wipeOfflineMaps().catch(() => undefined);
        await wipeAssessmentDrafts();
        wiped.current = true;
        form.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
