"use client";

import { useEffect, useState } from "react";

/** Shown inside a section while it is being rewritten: the old text stays until the new one is ready. */
export function RegenerationNotice({ since }: { since?: number }) {
  const [start] = useState(() => since ?? Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [start]);
  return (
    <div role="status" aria-live="polite" className="mb-3 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
      <span aria-hidden="true" className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span>Rewriting this section ({seconds} s). The current text stays until the new one is ready; if the AI cannot produce a valid version, the current text is kept and the reason is shown here.</span>
    </div>
  );
}
