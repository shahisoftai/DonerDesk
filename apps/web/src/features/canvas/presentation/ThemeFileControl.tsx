"use client";

import { useRef, useState } from "react";
import { CUSTOM_THEME_ID, THEME_SPECS, fontById, canvasThemeOf, exportThemeSpec, importThemeSpec, type Canvas, type ThemeSpec } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const BTN = "rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800";

/**
 * Load a theme from a file, or save the canvas's look as one (Phase 50.5, Power BI's import and export theme). A file is checked before it
 * is used (unknown settings, colours, bundled fonts, contrast); a refused file changes nothing and says why.
 */
export function ThemeFileControl({ canvas, onLoad }: { canvas: Canvas; onLoad: (spec: ThemeSpec) => void }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const current = (): ThemeSpec => {
    if (canvas.themeId === CUSTOM_THEME_ID && canvas.options?.themeSpec) return canvas.options.themeSpec;
    const gallery = THEME_SPECS.find((s) => s.id === canvas.themeId.split(":")[0]);
    const theme = canvasThemeOf(canvas);
    return gallery ? { id: gallery.id, label: gallery.label, description: gallery.description, accent: gallery.accent, ...(gallery.accent2 ? { accent2: gallery.accent2 } : {}), ...(gallery.font && fontById(gallery.font)?.bundled ? { font: gallery.font } : {}), ...(gallery.neutral ? { neutral: gallery.neutral } : {}), ...(gallery.radius !== undefined ? { radius: gallery.radius } : {}) } : { id: theme.id.replace(/[^A-Za-z0-9_-]/g, "_"), label: theme.label, description: theme.description, accent: theme.accent, accent2: theme.accent2 };
  };
  const save = () => {
    const blob = new Blob([exportThemeSpec(current())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${current().id}.theme.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        <button type="button" className={BTN} onClick={() => input.current?.click()}>{t("theme.import")}</button>
        <button type="button" className={BTN} onClick={save}>{t("theme.export")}</button>
        <input ref={input} type="file" accept="application/json,.json" className="hidden" aria-label={t("theme.import")} onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const r = importThemeSpec(await file.text());
          if (r.ok) { onLoad(r.spec); setMessage({ ok: true, text: t("theme.imported") }); } else setMessage({ ok: false, text: r.problems.slice(0, 3).join(" ") });
        }} />
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-xs ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>}
    </div>
  );
}
