import Link from "next/link";
import { countOf } from "@donordesk/domain/core/plural.js";
import type { SetupData } from "@/features/projects/application/overview-view";
import { OverviewSection } from "./overview-pieces";

/**
 * The definitions the reports draw on: the logframe, the donor templates and the reporting profile.
 * The things a report cannot be written without, in one place.
 */
export function SetupSection({ setup, projectId }: { setup: SetupData; projectId: string }) {
  return (
    <OverviewSection kicker="Setup" title="Definitions the report draws on">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30" href={`/projects/${projectId}/logframe`}>
          <h3 className="text-[13.5px] font-semibold">Logframe</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {setup.logframe
              ? `${countOf(setup.logframe.outcomes, "outcome", "outcomes")} · ${countOf(setup.logframe.outputs, "output", "outputs")} · ${countOf(setup.logframe.indicators, "indicator", "indicators")}`
              : "Not available"}
          </p>
        </Link>
        <Link className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30" href={`/projects/${projectId}/templates`}>
          <h3 className="text-[13.5px] font-semibold">Donor templates</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {setup.templates === null ? "Not available" : countOf(setup.templates, "template", "templates")}
          </p>
        </Link>
        <Link className="card transition hover:border-brand-400/40 dark:hover:border-brand-400/30" href={`/projects/${projectId}/settings`}>
          <h3 className="text-[13.5px] font-semibold">Reporting profile</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {setup.profile.reportingFrequency.replace(/_/g, " ").toLowerCase()} reporting
            {setup.profile.secondApprover === null ? "" : setup.profile.secondApprover ? " · a second approver is required" : " · one approver"}
            {setup.profile.autoCreate === null ? "" : setup.profile.autoCreate ? " · new periods are created automatically" : ""}
          </p>
        </Link>
      </div>
    </OverviewSection>
  );
}
