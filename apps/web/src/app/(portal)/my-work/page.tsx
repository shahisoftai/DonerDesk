import { redirect } from "next/navigation";

/** My Work is the Inbox's "To do" (and "Team") since Version 4.000. */
export default async function MyWorkRedirect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  const query = params.toString();
  redirect(`/inbox${query ? `?${query}` : ""}`);
}
