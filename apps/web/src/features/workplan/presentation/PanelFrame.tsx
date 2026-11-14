"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { DRAWER_SCRIM, DRAWER_SURFACE } from "@/components/feedback/Drawer";

/**
 * A panel that slides in from the right over the page behind it, with the same look as every other slide-over (`Drawer`).
 * Escape, the close button, or a click outside closes it (it goes back to the list). It is announced as a dialog, takes focus
 * when it opens, and does not animate for people who ask for less motion.
 */
export function PanelFrame({ children, label = "Activity details" }: { children: ReactNode; label?: string }) {
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
      <div className={`fixed inset-0 z-40 ${DRAWER_SCRIM} ${shown ? "opacity-100" : "opacity-0"}`} onClick={() => router.back()} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`fixed inset-y-0 end-0 z-50 w-[min(560px,100vw)] sm:inset-y-2 sm:end-2 sm:rounded-2xl ${DRAWER_SURFACE} ${shown ? "translate-x-0" : "translate-x-[calc(100%+1rem)] rtl:-translate-x-[calc(100%+1rem)]"}`}
      >
        <div className="flex shrink-0 justify-end border-b border-slate-200 px-3 py-2 dark:border-white/10">
          <button ref={close} type="button" onClick={() => router.back()} aria-label="Close details" title="Close (Esc)" className="btn-ghost btn-icon">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </aside>
    </>
  );
}
