"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toneFor, type Tone } from "@/lib/shared/tone";

/** An optional button on a toast, e.g. "Undo" after a reversible action. */
export type ToastAction = { label: string; onAction: () => void };

type Toast = { id: number; title: string; description?: string; tone: Tone; action?: ToastAction };

type ToastInput = {
  title: string;
  description?: string;
  tone?: Tone;
  action?: ToastAction;
  /** How long the toast stays (default 5s). Undo toasts use a longer window. */
  durationMs?: number;
};

const DEFAULT_DURATION_MS = 5000;

const ToastContext = createContext<{ push: (input: ToastInput) => void }>({ push: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

const toastStyles: Record<Tone, string> = {
  neutral: "border-slate-300 bg-white text-slate-800 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100",
  info: "border-brand-500/40 bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  success: "border-success-500/50 bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  warning: "border-warning-500/50 bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  danger: "border-danger-500/50 bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  ai: "border-ai-500/50 bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100",
};

const dotStyles: Record<Tone, string> = {
  neutral: "bg-slate-500",
  info: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  ai: "bg-ai-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current;
      const tone = toneFor(input.tone);
      setToasts((current) => [...current, { id, title: input.title, description: input.description, tone, action: input.action }]);
      window.setTimeout(() => dismiss(id), input.durationMs ?? DEFAULT_DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} role="status" className={`pointer-events-auto flex items-start gap-2 rounded-lg border p-3 shadow-lg ${toastStyles[toast.tone]}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotStyles[toast.tone]}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{toast.description}</p>}
            </div>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  dismiss(toast.id);
                  toast.action?.onAction();
                }}
                className="-my-1 min-h-[36px] shrink-0 rounded-md px-2 text-sm font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
