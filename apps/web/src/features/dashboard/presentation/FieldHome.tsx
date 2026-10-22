import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { MyWeekSchema } from "@/lib/server/schemas";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { loadDashboard } from "../application/dashboard-read-model";
import { loadWorkItems } from "@/features/work-items/application/work-items-read-model";
import { workItemHref, workItemMeta, workItemTitle } from "@/features/work-items/presentation/work-items-view";
import { MyWeekPanel } from "@/features/workplan/presentation/MyWeekPanel";
import { Badge } from "@/components/data/Badge";
import { InlineError } from "@/components/feedback/PageState";
import { HomeHeader, NotificationsList, Panel, QuickLinks, type QuickLink } from "./HomeParts";

type Ctx = Awaited<ReturnType<typeof requireSession>>;

/** Home for a field officer: this week's planned work first, then what was sent back, then the things they record. */
export async function FieldHome({ ctx }: { ctx: Ctx }) {
  const identity = decodeSessionPayload(ctx.token);
  const [week, snapshot, work] = await Promise.all([
    gatewayRequest("/v1/me/week", MyWeekSchema, ctx.token),
    loadDashboard(ctx.token),
    loadWorkItems(ctx.token),
  ]);
  const projects = (snapshot.projects.ok ? snapshot.projects.value ?? [] : []).filter((p) => p.status === "ACTIVE");
  const notifications = snapshot.notifications.ok ? snapshot.notifications.value ?? [] : [];
  const items = work.ok ? work.items : [];
  const firstName = (identity?.name ?? "").split(" ")[0];
  const sentBack = week.ok ? week.value.sentBack.length : 0;
  const planned = week.ok ? week.value.planned.length : 0;

  const links: QuickLink[] = [];
  if (ctx.capabilities.has("activity.create")) links.push({ href: "/projects", label: "Record a completed activity", hint: "Pick the project, then Activities" });
  if (ctx.capabilities.has("evidence.upload")) links.push({ href: "/evidence", label: "Upload evidence" });
  links.push({ href: "/my-work", label: "Everything assigned to me" });
  links.push({ href: "/projects", label: "My projects" });

  return (
    <div className="animate-fade-in space-y-6">
      <HomeHeader
        eyebrow="My week"
        title={`Welcome back${firstName ? `, ${firstName}` : ""}. ${sentBack > 0 ? `${sentBack} activit${sentBack === 1 ? "y was" : "ies were"} sent back to you.` : planned > 0 ? `${planned} planned activit${planned === 1 ? "y" : "ies"} this week.` : "Nothing is planned for you this week."}`}
        subtitle="Your planned work, what needs fixing, and the quickest ways to record what you did."
        actions={<Link className="btn-secondary" href="/my-work">Open My Work</Link>}
      />
      {!week.ok && <InlineError title={week.error.message} referenceId={week.error.referenceId} />}
      {week.ok && <MyWeekPanel week={week.value} projects={projects.map((p) => ({ id: p.id, title: p.title }))} />}
      <QuickLinks links={links} />
      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Waiting for me" href="/my-work" linkLabel="View all →">
          {items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Nothing is waiting for you.</p> : (
            <ul className="space-y-2">
              {items.slice(0, 5).map((i) => (
                <li key={`${i.kind}-${i.id}`}>
                  <Link href={workItemHref(i)} className="card block transition hover:border-brand-400/40">
                    <Badge tone="info" className="mr-2">{i.kind}</Badge><span className="text-sm font-medium">{workItemTitle(i)}</span>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{workItemMeta(i)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Notifications" href="/notifications" linkLabel="Open inbox →"><NotificationsList items={notifications} /></Panel>
      </section>
    </div>
  );
}
