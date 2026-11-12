import Link from "next/link";
import { FRAMEWORK_LENS_KEYS } from "@donordesk/domain/contexts/logframe/framework-lenses.js";
import { getTranslator } from "@/lib/server/locale";

/** The ways to look at the framework: editing it, or either lens. The same results and indicators sit behind every choice. */
const VIEW_KEYS: ReadonlyArray<string> = ["edit", ...FRAMEWORK_LENS_KEYS];

export async function FrameworkViewSwitch({ projectId, current }: { projectId: string; current: string }) {
  const { t } = await getTranslator();
  return (
    <nav aria-label={t("framework.view.label")} className="inline-flex rounded-md border border-slate-200 p-0.5 text-sm dark:border-white/10">
      {VIEW_KEYS.map((key) => (
        <Link
          key={key}
          href={key === "edit" ? `/projects/${projectId}/logframe` : `/projects/${projectId}/logframe?view=${key}`}
          aria-current={current === key ? "page" : undefined}
          className={`rounded px-3 py-1 ${current === key ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"}`}
        >
          {t(`framework.view.${key}`)}
        </Link>
      ))}
    </nav>
  );
}
