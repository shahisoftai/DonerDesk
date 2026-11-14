import { redirect } from "next/navigation";

/** Notifications are the Inbox's "Updates" since Version 4.000. */
export default async function NotificationsRedirect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filter = (await searchParams).filter;
  redirect(`/inbox?tab=updates${filter ? `&filter=${encodeURIComponent(filter)}` : ""}`);
}
