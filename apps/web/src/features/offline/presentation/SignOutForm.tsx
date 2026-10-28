"use client";

import { useRef, type ReactNode } from "react";
import { wipeOfflinePacks } from "../infrastructure/indexeddb-pack-store";

/** Signing out removes the offline packs from this phone first, so the next person to use it finds none of the last person's. */
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
        wiped.current = true;
        form.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
