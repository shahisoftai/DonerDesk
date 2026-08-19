import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { NotificationsResponseSchema } from "@/lib/server/schemas";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { MarkReadButton } from "./MarkReadButton";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  ASSIGNMENT: "Assignment",
  EVIDENCE_REVIEW: "Evidence review",
  DEADLINE_REMINDER: "Deadline",
  COMMENT_MENTION: "Mention",
  CHECKLIST_ASSIGNED: "Compliance",
  REPORT_APPROVED: "Report approved",
  REPORT_RETURNED: "Report returned",
  EXPORT_COMPLETED: "Export",
  INVITATION: "Invitation",
  PASSWORD_RESET: "Password",
};

type Notification = {
  id: string;
  type?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt?: string;
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ctx = await requireSession();
  const result = await gatewayRequest("/v1/notifications", NotificationsResponseSchema, ctx.token);

  const raw = (key: string) => {
    const v = params[key];
    return typeof v === "string" ? v : "";
  };
  const filter = raw("filter") || "all";

  const items = result.ok ? (result.value.items as Notification[]) : [];
  const filtered = filter === "unread" ? items.filter((n) => !n.read) : filter === "read" ? items.filter((n) => n.read) : items;
  const unreadCount = result.ok ? items.filter((n) => !n.read).length : 0;

  const group = new Map<string, Notification[]>();
  for (const n of filtered) {
    const date = n.createdAt ? new Date(n.createdAt).toDateString() : "Unknown";
    const list = group.get(date) ?? [];
    list.push(n);
    group.set(date, list);
  }

  const chip = (value: string, label: string) => {
    const href = `/notifications${value === "all" ? "" : `?filter=${value}`}`;
    return (
      <Link href={href} className={`rounded-lg border px-3 py-1 text-xs ${filter === value ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-slate-300 dark:border-white/15"}`}>
        {label}
      </Link>
    );
  };

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{unreadCount} unread</p>
        </div>
        <div className="flex gap-2">
          {chip("all", "All")}
          {chip("unread", "Unread")}
          {chip("read", "Read")}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {!result.ok && <div className="mt-4"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>}
        {result.ok && filtered.length === 0 && <EmptyState>No notifications here.</EmptyState>}
        {[...group.entries()].map(([date, list]) => (
          <section key={date}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">{date}</h2>
            <ul className="mt-2 space-y-2">
              {list.map((n) => (
                <li key={n.id} className={`rounded-xl border px-4 py-3 ${n.read ? "border-slate-200/60 bg-white dark:border-white/10 dark:bg-white/[0.03]" : "border-brand-400/40 bg-white dark:bg-white/[0.05]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={n.read ? "neutral" : "info"}>{TYPE_LABEL[n.type ?? ""] ?? (n.type ?? "Notification")}</Badge>
                        <span className="font-semibold">{n.title}</span>
                      </div>
                      {n.message && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.message}</p>}
                    </div>
                    {!n.read && <MarkReadButton id={n.id} />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
