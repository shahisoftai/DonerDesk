import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { PageHeader } from "@/components/layout/Page";
import { cn } from "@/components/ui/cn";
import { TodoView } from "./_views/TodoView";
import { UpdatesView } from "./_views/UpdatesView";

export const dynamic = "force-dynamic";

/**
 * The Inbox (Version 4.000, plan F2/F3): what is yours to do, your team's work (managers), and updates. Replaces My Work and
 * Notifications, whose addresses redirect here. "Waiting to send" (the offline queue) stays its own page by decision.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const ctx = await requireSession();
  const canTeam = ctx.capabilities.has("team.view-work");
  const tab = one("tab") === "updates" ? "updates" : one("tab") === "team" && canTeam ? "team" : "todo";

  const tabs = [
    { key: "todo", label: "To do", href: "/inbox" },
    ...(canTeam ? [{ key: "team", label: "Team", href: "/inbox?tab=team" }] : []),
    { key: "updates", label: "Updates", href: "/inbox?tab=updates" },
  ];
  const heading = (
    <>
      <PageHeader
        title="Inbox"
        description="Everything that is yours to do, by when it is due, and what changed."
        actions={<Link href="/waiting" className="btn-secondary">Waiting to send</Link>}
      />
      <nav aria-label="Inbox" className="mt-4 flex gap-1 border-b border-slate-200 dark:border-white/10">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-10 items-center px-3 text-sm font-medium",
              tab === t.key
                ? "text-brand-700 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-700 dark:text-brand-300 dark:after:bg-brand-300"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );

  if (tab === "updates") return <UpdatesView params={params} heading={heading} />;
  return <TodoView tab={tab === "team" ? "team" : undefined} project={one("project")} person={one("person")} kind={one("kind")} heading={heading} />;
}
