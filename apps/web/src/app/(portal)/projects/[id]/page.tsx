import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { loadProjectOverviewV2 } from "@/features/projects/application/overview-read-model";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { PeriodSwitcher } from "@/features/projects/presentation/PeriodSwitcher";
import { projectStatusTone } from "@/lib/shared/tone";
import { LifecycleStrip } from "@/features/projects/presentation/overview/LifecycleStrip";
import { NeedsYouSection } from "@/features/projects/presentation/overview/NeedsYouSection";
import { PulseSection } from "@/features/projects/presentation/overview/PulseSection";
import { CalendarSection } from "@/features/projects/presentation/overview/CalendarSection";
import { ReportingSection } from "@/features/projects/presentation/overview/ReportingSection";
import { DeliverySection } from "@/features/projects/presentation/overview/DeliverySection";
import { ResultsMoneySection } from "@/features/projects/presentation/overview/ResultsMoneySection";
import { TeamSection } from "@/features/projects/presentation/overview/TeamSection";
import { RisksCard } from "@/features/tasks/presentation/RisksCard";
import { DecisionLog } from "@/features/tasks/presentation/DecisionLog";
import { CloseOutSection } from "@/features/projects/presentation/overview/CloseOutSection";
import { SetupSection } from "@/features/projects/presentation/overview/SetupSection";
import { DeleteDemoProjectButton } from "@/features/tour/presentation/DeleteDemoProjectButton";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";

export const dynamic = "force-dynamic";

/**
 * The project Overview: one page composed of sections, each showing only to the roles that need it
 * (`sectionsFor`). It reads; every action on it is a link to the surface that owns the work.
 */
export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const [resolvedParams, { period }] = await Promise.all([params, searchParams]);
  const ctx = await requireSession();
  const today = new Date().toISOString().slice(0, 10);
  const meId = decodeSessionPayload(ctx.token)?.sub ?? "";
  const load = await loadProjectOverviewV2(ctx.token, resolvedParams.id, {
    role: ctx.role,
    capabilities: ctx.capabilities,
    today,
    meId,
  });

  if (!load.ok || !load.value) {
    return <InlineError title={load.error?.message ?? "Project could not be loaded."} referenceId={load.error?.referenceId} />;
  }
  const data = load.value;
  const { identity, life, sections } = data;
  const has = (section: (typeof sections)[number]) => sections.includes(section);
  const periods = data.reporting.ok ? data.reporting.value.periods : [];
  const activePeriodId = data.reporting.ok ? data.reporting.value.activePeriodId : null;
  const riskPeople = data.risks.ok ? data.risks.value.people : [];
  const planPeople = data.delivery.ok ? data.delivery.value.people : [];

  return (
    <div data-tour-id="demo-project-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {identity.donorName} · {identity.country} · {identity.sector.replace(/_/g, " ")}
        </div>
        <div className="flex gap-2">
          {identity.isDemo ? <Badge tone="info">Demo</Badge> : null}
          <Badge tone={projectStatusTone(identity.status)}>{identity.status.replace(/_/g, " ")}</Badge>
          <Badge tone="neutral">{identity.reportingFrequency.toLowerCase().replace("_", " ")}</Badge>
        </div>
      </div>

      {identity.isDemo ? (
        <div className="mt-3">
          <DeleteDemoProjectButton projectId={identity.id} />
        </div>
      ) : null}

      <LifecycleStrip life={life} />

      {periods.length > 0 ? (
        <section className="mt-4" aria-label="Reporting period">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="period-select">Reporting period</label>
          <PeriodSwitcher periods={periods.map((p) => ({ id: p.id, reportType: p.reportType, status: p.status }))} value={activePeriodId ?? ""} />
        </section>
      ) : null}

      {!has("REPORTING") ? (
        <section className="mt-6">
          <div className="card">
            <h2 className="font-medium">Set up your reporting period</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Create a reporting period to start collecting evidence and generating a report.
            </p>
            <Link className="btn mt-3" href={`/projects/${identity.id}/reports/new`}>Create reporting period</Link>
          </div>
        </section>
      ) : null}

      {has("NEEDS_YOU") && data.needsYou.ok ? (
        <NeedsYouSection items={data.needsYou.value} projectId={identity.id} />
      ) : null}

      {has("PULSE") && data.pulse.ok ? <PulseSection pulse={data.pulse.value} projectId={identity.id} /> : null}

      {has("CALENDAR") && data.calendar.ok ? <CalendarSection items={data.calendar.value} projectId={identity.id} /> : null}

      {has("REPORTING") && data.reporting.ok ? <ReportingSection reporting={data.reporting.value} projectId={identity.id} /> : null}

      {has("DELIVERY") && data.delivery.ok ? <DeliverySection delivery={data.delivery.value} projectId={identity.id} /> : null}

      {has("RESULTS") && data.results.ok ? <ResultsMoneySection results={data.results.value} projectId={identity.id} /> : null}

      {has("TEAM") && data.team.ok ? (
        <TeamSection
          team={data.team.value}
          people={riskPeople}
          projectId={identity.id}
          today={today}
          periods={periods.map((p) => ({ id: p.id, label: p.title }))}
        />
      ) : null}

      {has("RISKS") && data.risks.ok ? (
        <>
          <div className="mt-8">
            <RisksCard
              projectId={identity.id}
              risks={data.risks.value.items}
              people={riskPeople}
              userId={meId}
              canRaise={ctx.capabilities.has("risk.raise")}
              today={today}
            />
          </div>
          <div className="mt-4">
            <DecisionLog risks={data.risks.value.items} people={riskPeople} />
          </div>
        </>
      ) : null}

      {has("CLOSEOUT") && data.closeOut.ok ? <CloseOutSection closeOut={data.closeOut.value} projectId={identity.id} /> : null}

      {has("SETUP") && data.setup.ok ? <SetupSection setup={data.setup.value} projectId={identity.id} /> : null}

      {has("REPORTING") && !data.reporting.ok ? (
        <div className="mt-8">
          <EmptyState>Readiness for this reporting period is not available.</EmptyState>
        </div>
      ) : null}

      {planPeople.length > 0 ? <span className="sr-only">{planPeople.length} people on this project</span> : null}
    </div>
  );
}
