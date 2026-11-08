import { ok, willApplyItem } from "@donordesk/domain";
import type { ISetupLaunchStep, SetupLibraryLinkWriter } from "../../../ports/project-setup-launch.js";

/** Links each indicator chosen from the sector library to its entry, once the project's indicators exist. Safe to run again. */
export class LibraryLinksStep implements ISetupLaunchStep {
  readonly key = "LIBRARY_LINKS";
  constructor(private readonly writer: SetupLibraryLinkWriter) {}
  async run(...[ctx, projectId, draft]: Parameters<ISetupLaunchStep["run"]>) {
    const items = draft.proposal.indicators.flatMap((i) => {
      const v = i.value;
      return willApplyItem(i) && v?.code && v.libraryId && v.libraryVersion !== undefined && v.libraryLinkJson
        ? [{ code: v.code, libraryId: v.libraryId, libraryVersion: v.libraryVersion, linkJson: v.libraryLinkJson }]
        : [];
    });
    if (items.length === 0) return ok({ done: 0, notes: [] });
    const r = await this.writer.link(ctx, projectId, items);
    return r.ok ? ok({ done: r.value.linked, notes: r.value.notes }) : r;
  }
}
