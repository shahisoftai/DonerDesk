import type { Capability } from "@/lib/shared/capabilities";
import { setupChecklist, type Checklist } from "@/features/projects/domain/setup-checklist";
import type { OverviewPageData } from "./overview-read-model";

/** The setup checklist for a person, from the Overview's own read (no second set of calls). Null when the setup could not be read. */
export function checklistOf(data: OverviewPageData, capabilities: ReadonlySet<Capability>): Checklist | null {
  if (!data.setup.ok) return null;
  const periods = data.reporting.ok ? data.reporting.value.periods.length : 0;
  return setupChecklist({
    facts: {
      indicators: data.setup.value.logframe?.indicators ?? 0,
      periods,
      teamSize: data.risks.ok ? data.risks.value.people.length : 0,
      hasSites: data.location.ok ? data.location.value.sites.points.length > 0 : false,
      planningVisible: data.delivery.ok,
      plannedActivities: data.delivery.ok ? data.delivery.value.counts.planned : 0,
      templates: data.setup.value.templates ?? 0,
      hasBudget: data.pulse.ok ? data.pulse.value.budget !== null : false,
      risks: data.risks.ok ? data.risks.value.items.length : 0,
    },
    capabilities,
    reportDueWithinDays: data.pulse.ok ? data.pulse.value.nextDeadline?.days ?? null : null,
  });
}
