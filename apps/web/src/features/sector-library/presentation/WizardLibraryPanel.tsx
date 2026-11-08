"use client";

import { useMemo, useState } from "react";
import type { LibrarySectorId } from "@donordesk/domain";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { draftAdopter, libraryBrowser } from "../composition";
import { LibraryPicker } from "./LibraryPicker";

/**
 * "Choose from the library" on the wizard's Results and Indicators slides. The picker opens on request, starts on the sectors chosen
 * on the Start slide, and adds into the draft; the slide redraws from the draft the server answers with. Nothing is added by opening it.
 */
export function WizardLibraryPanel({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const adopter = useMemo(() => draftAdopter(id, onView), [id, onView]);
  const targets = view.logframe.flatMap((n) => (n.value.code ? [{ id: n.value.code, label: `${n.value.code} ${n.value.title ?? ""}`.trim() }] : []));
  const sectors = (view.extras.start.sectors ?? []) as LibrarySectorId[];
  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-white/10" data-testid="wizard-library">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t("lib.title")}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">{t("lib.chooseHelp")}</p>
        </div>
        <button type="button" className="btn-secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="wizard-library-toggle">{open ? t("lib.close") : t("lib.choose")}</button>
      </div>
      {open ? <div className="mt-3"><LibraryPicker browser={libraryBrowser} adopter={adopter} targets={targets} targetKey="logframeCode" initialSectors={sectors} /></div> : null}
    </section>
  );
}
