import Link from "next/link";
import { Badge } from "@/components/data/Badge";
import { workItemHref, workItemMeta, workItemTitle } from "@/features/work-items/presentation/work-items-view";
import { CollapsedPanel, NotificationsList, Panel, QuickLinks } from "../HomeParts";
import { DeliverySparkline, StatList } from "../HomeWidgets";
import type { PortfolioHomeData } from "../../application/portfolio-home-model";

const sum = (d: PortfolioHomeData, pick: (r: PortfolioHomeData["rows"][number]) => number) => d.rows.reduce((n, r) => n + pick(r), 0);
const workCount = (d: PortfolioHomeData, kind: string) => (d.work.ok ? String(d.items.filter((i) => i.kind === kind).length) : "—");

export function DeliveryPanel(d: PortfolioHomeData) {
  if (!d.overview.ok) return null;
  const late = sum(d, (r) => r.delivery.lateActivities);
  return (
    <Panel title="Delivery this week" href="/my-work" linkLabel="Work plan →">
      <div className="mb-3"><DeliverySparkline points={d.extra.deliveryWeeks} /></div>
      <StatList rows={[
        { label: "Late planned activities", value: String(late), href: "/my-work", tone: late > 0 ? "danger" : undefined },
        { label: "Completed activities to review", value: workCount(d, "activity"), href: "/my-work?type=activity" },
        { label: "Projects with a delay", value: String(d.rows.filter((r) => r.delivery.band === "OFF_TRACK" || r.delivery.band === "AT_RISK").length), href: "/portfolio" },
      ]} />
    </Panel>
  );
}

export function DataEvidencePanel(d: PortfolioHomeData) {
  if (!d.overview.ok) return null;
  const overdue = sum(d, (r) => r.delivery.valuesOverdue);
  const files = d.snapshot.pendingEvidence.ok && d.snapshot.pendingEvidence.value !== null ? String(d.snapshot.pendingEvidence.value) : "—";
  return (
    <Panel title="Data and evidence" href="/portfolio/indicators" linkLabel="Indicators →">
      <StatList rows={[
        { label: "Indicator values overdue", value: String(overdue), href: "/portfolio/indicators", tone: overdue > 0 ? "warning" : undefined },
        { label: "Files to verify", value: files, href: "/evidence" },
        { label: "Compliance blockers", value: workCount(d, "checklist"), href: "/compliance" },
      ]} />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">A missing value is shown as missing, never as zero.</p>
    </Panel>
  );
}

export function YourWorkPanel(d: PortfolioHomeData) {
  if (d.items.length === 0) return <CollapsedPanel title="Your work" message="No urgent work items right now." href="/my-work" linkLabel="View all →" />;
  return (
    <Panel title="Your work" href="/my-work" linkLabel="View all →">
      <ul className="space-y-2">
        {d.items.slice(0, 4).map((i) => (
          <li key={`${i.kind}-${i.id}`}>
            <Link href={workItemHref(i)} className="card block transition hover:border-brand-400/40">
              <Badge tone="info" className="mr-2">{i.kind}</Badge><span className="text-sm font-medium">{workItemTitle(i)}</span>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{workItemMeta(i)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function NotificationsPanel(d: PortfolioHomeData) {
  if (d.notifications.length === 0) return <CollapsedPanel title="Notifications" message="Nothing new." href="/notifications" linkLabel="Open inbox →" />;
  return <Panel title="Notifications" href="/notifications" linkLabel="Open inbox →"><NotificationsList items={d.notifications} /></Panel>;
}

export function GrantsPanel(d: PortfolioHomeData) {
  if (!d.director || d.grants.length === 0) return null;
  return (
    <Panel title="Grants" href="/programmes" linkLabel="Programmes and grants →">
      <div className="grid gap-3 sm:grid-cols-2">
        {d.grants.slice(0, 6).map((g) => (
          <Link key={g.id} href="/programmes" className="card min-w-0 transition hover:border-brand-400/40">
            <div className="break-words text-sm font-medium leading-5">{g.title}</div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{g.donorName}{g.endDate ? ` · ends ${new Date(g.endDate).toLocaleDateString()}` : ""}</div>
            {g.amount && <div className="mt-2 text-sm tabular-nums">{g.currency ?? ""} {Number(g.amount).toLocaleString()}</div>}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export function QuickLinksPanel(d: PortfolioHomeData) {
  return <QuickLinks links={[...d.links]} />;
}
