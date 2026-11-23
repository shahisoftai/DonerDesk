"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { Task, VisitTask, WeekGroup, WorkTask } from "../../domain/field-today";
import { VisitRow, WorkRow } from "./VisitCards";
import { dayLabel } from "./words";

/** My week: what is late, then each day that has something. A visit is opened from here the same way as from Today. */
export function WeekScreen({ groups, onStartVisit, onRecord }: { groups: WeekGroup[]; onStartVisit: (v: VisitTask) => void; onRecord: (w: WorkTask) => void }) {
  const { t, locale } = useI18n();
  const row = (task: Task) => (task.kind === "VISIT" ? <VisitRow visit={task} onStart={() => onStartVisit(task)} /> : <WorkRow work={task} onRecord={() => onRecord(task)} />);
  return (
    <div>
      <h1 className="text-3xl font-bold">{t("fa.week.title")}</h1>
      {groups.length === 0 && <p className="mt-6 rounded-2xl bg-slate-100 p-5 text-base dark:bg-white/10">{t("fa.week.empty")}</p>}
      {groups.map((g) => (
        <section key={g.key} className="mt-6" aria-label={g.kind === "DAY" && g.day ? dayLabel(g.day, locale, true) : g.kind === "OVERDUE" ? t("fa.week.late") : t("fa.week.noDate")}>
          <h2 className={`mb-3 text-lg font-bold ${g.kind === "OVERDUE" ? "text-warning-800 dark:text-warning-200" : ""}`}>
            {g.kind === "DAY" && g.day ? dayLabel(g.day, locale, true) : g.kind === "OVERDUE" ? t("fa.week.late") : t("fa.week.noDate")}
          </h2>
          <ul className="space-y-3">{g.items.map((task) => <li key={`${task.kind}:${task.id}`}>{row(task)}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}
