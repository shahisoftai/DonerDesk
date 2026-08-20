"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toneFor, type Tone } from "@/lib/shared/tone";

type Toast = { id: number; title: string; description?: string; tone: Tone };

type ToastInput = { title: string; description?: string; tone?: Tone };

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

  const push = useCallback((input: ToastInput) => {
    const id = ++idRef.current;
    const tone = toneFor(input.tone);
    setToasts((current) => [...current, { id, title: input.title, description: input.description, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} role="status" className={`pointer-events-auto flex items-start gap-2 rounded-lg border p-3 shadow-lg ${toastStyles[toast.tone]}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotStyles[toast.tone]}`} aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{toast.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
