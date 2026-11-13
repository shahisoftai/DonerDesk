"use server";

import { requireSession } from "@/lib/server/auth-context";
import { searchHelp } from "@/lib/server/help-search";
import type { HelpHit } from "@/features/help/domain/help-rank";

/** Looks a question up in the help articles. Needs only a signed-in session: the articles are public and nothing of the organisation is read. */
export async function searchHelpAction(query: string): Promise<HelpHit[]> {
  await requireSession();
  return searchHelp(String(query ?? ""));
}
