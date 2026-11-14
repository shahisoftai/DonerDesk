"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";
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
  const pathname = usePathname();
  // Previous and next (plan F65): the list behind the panel marks its rows with `data-panel-item`; J/K or the arrows step through
  // them without closing the panel, and each step has its own address.
  const siblings = () => [...document.querySelectorAll<HTMLAnchorElement>("a[data-panel-item]")].map((a) => a.getAttribute("href") ?? "").filter(Boolean);
  const step = (by: 1 | -1) => {
    const list = siblings();
    const at = list.indexOf(pathname);
    const to = list[at + by];
    if (at >= 0 && to) router.replace(to, { scroll: false });
  };

  useEffect(() => {
    setShown(true);
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) router.back();
      else if (!typing && !e.metaKey && !e.ctrlKey && (e.key === "j" || e.key === "k")) step(e.key === "j" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, pathname]);

  return (
    <>
      <div className={`fixed inset-0 z-40 ${DRAWER_SCRIM} ${shown ? "opacity-100" : "opacity-0"}`} onClick={() => router.back()} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`fixed inset-y-0 end-0 z-50 w-[min(560px,100vw)] sm:inset-y-2 sm:end-2 sm:rounded-2xl ${DRAWER_SURFACE} ${shown ? "translate-x-0" : "translate-x-[calc(100%+1rem)] rtl:-translate-x-[calc(100%+1rem)]"}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => step(-1)} aria-label="Previous (K)" title="Previous (K)" className="btn-ghost btn-icon"><ChevronUp aria-hidden="true" /></button>
            <button type="button" onClick={() => step(1)} aria-label="Next (J)" title="Next (J)" className="btn-ghost btn-icon"><ChevronDown aria-hidden="true" /></button>
          </span>
          <button ref={close} type="button" onClick={() => router.back()} aria-label="Close details" title="Close (Esc)" className="btn-ghost btn-icon">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </aside>
    </>
  );
}
