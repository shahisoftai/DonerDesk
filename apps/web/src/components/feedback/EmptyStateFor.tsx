import Link from "next/link";
import { EmptyState } from "./PageState";
import { emptyView, type EmptyKey } from "@/lib/shared/empty-states";

/** An empty page from the table in `lib/shared/empty-states.ts`: a title, why it is empty, and at most one button. */
export function EmptyStateFor({ kind, capabilities, projectId }: { kind: EmptyKey; capabilities: ReadonlySet<string>; projectId?: string }) {
  const v = emptyView(kind, capabilities, projectId);
  return <EmptyState title={v.title} action={v.action ? <Link className="btn" href={v.action.href}>{v.action.label}</Link> : undefined}>{v.reason}</EmptyState>;
}
