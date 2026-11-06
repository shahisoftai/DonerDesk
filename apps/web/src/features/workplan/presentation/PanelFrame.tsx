"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * A panel that slides in from the right over the page behind it. Escape, the close button, or a click outside closes it (it goes
 * back to the list). It is announced as a dialog, takes focus when it opens, and does not animate for people who ask for less motion.
 */
export function PanelFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setShown(true);
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) router.back(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => router.back()} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Activity details"
        className={`fixed inset-y-0 right-0 z-50 w-[min(520px,100vw)] overflow-y-auto bg-white p-5 shadow-2xl transition-transform duration-200 motion-reduce:transition-none dark:bg-slate-900 ${shown ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="mb-3 flex justify-end">
          <button ref={close} type="button" onClick={() => router.back()} aria-label="Close details" className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-300 text-lg dark:border-white/15">×</button>
        </div>
        {children}
      </aside>
    </>
  );
}
