"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and until React has taken over the page. A form that is typed into before that moment loses
 * what was typed (the controlled inputs are reset when hydration finishes), silently. Disabling the form until this
 * is true makes "not ready yet" visible instead.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
