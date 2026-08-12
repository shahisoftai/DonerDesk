"use client";

import { useEffect } from "react";

export function UnsavedChangesGuard({ dirty, message }: { dirty: boolean; message?: string }) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message ?? "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, message]);

  return null;
}
