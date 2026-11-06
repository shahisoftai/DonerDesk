"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Capability } from "@/lib/shared/capabilities";
import { Drawer } from "@/components/feedback/Drawer";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useNetworkRecordDeps } from "../composition";
import { RecordSheetBody, type RecordRequest } from "./RecordSheetBody";

interface RecordSheetApi {
  /** Opens the Record sheet, optionally already on a project, a kind or an indicator. */
  open(request?: RecordRequest): void;
}

const Context = createContext<RecordSheetApi>({ open: () => undefined });

/** Any screen asks for the Record sheet through this; outside a host it quietly does nothing. */
export function useRecordSheet(): RecordSheetApi {
  return useContext(Context);
}

/**
 * Owns the one Record sheet of the signed-in app: a bottom sheet on a phone, a side drawer on a larger screen. Buttons anywhere (the
 * header, Today, a row in Needs you) open it through `useRecordSheet`, so recording starts the same way from every screen.
 */
export function RecordHost({ capabilities, children }: { capabilities: readonly Capability[]; children: ReactNode }) {
  const { t } = useI18n();
  const deps = useNetworkRecordDeps();
  const [request, setRequest] = useState<RecordRequest | null>(null);
  const [wide, setWide] = useState(true);
  // Each opening starts the sheet afresh, so the last record's answers never leak into the next one.
  const [session, setSession] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const open = useCallback((r: RecordRequest = {}) => { setSession((n) => n + 1); setRequest(r); }, []);
  const close = useCallback(() => setRequest(null), []);
  const api = useMemo<RecordSheetApi>(() => ({ open }), [open]);

  return (
    <Context.Provider value={api}>
      {children}
      <Drawer open={request !== null} onClose={close} title={t("record.sheet.title")} side={wide ? "right" : "bottom"} wide>
        {request !== null && <RecordSheetBody key={session} deps={deps} capabilities={capabilities} request={request} onClose={close} />}
      </Drawer>
    </Context.Provider>
  );
}
