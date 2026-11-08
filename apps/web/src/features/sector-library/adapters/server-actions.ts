import { addLibraryToDraftAction, adoptLibraryAction, adoptSkeletonAction, browseLibraryAction } from "@/lib/actions/sector-library";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { queryFor } from "../domain/picker-state";
import type { LibraryAdopter, LibraryBrowser, LibraryPage } from "../ports/library-port";

/** Reads the library through the server action. The only place the picker's browsing meets the network. */
export const serverBrowser: LibraryBrowser = {
  async sectors() {
    const r = await browseLibraryAction({ limit: 1 });
    return r.ok ? { ok: true, value: r.value.sectors } : { ok: false, message: r.error.message };
  },
  async browse(filters, projectId) {
    const r = await browseLibraryAction(queryFor(filters, projectId));
    if (!r.ok) return { ok: false, message: r.error.message };
    const page: LibraryPage = { libraryVersion: r.value.libraryVersion, sectors: r.value.sectors, total: r.value.total, groups: r.value.groups };
    return { ok: true, value: page };
  },
};

/** Adopts into a real project's logframe. */
export function projectAdopter(projectId: string): LibraryAdopter {
  return {
    async adopt(ids, target) {
      const r = await adoptLibraryAction({ projectId, items: ids.map((libraryId) => ({ libraryId, ...(target.logframeItemId ? { logframeItemId: target.logframeItemId } : {}) })) });
      if (!r.ok) return { ok: false, message: r.error.message };
      return { ok: true, value: { added: r.value.created.length, skipped: r.value.skipped.map((s) => ({ id: s.libraryId, reason: s.reason })) } };
    },
    async adoptSkeleton(sectorId) {
      const r = await adoptSkeletonAction({ projectId, sectorId });
      return r.ok ? { ok: true, value: { added: r.value.created.length } } : { ok: false, message: r.error.message };
    },
  };
}

/** Adopts into the wizard's draft; `onView` receives the re-derived draft so the slide redraws. */
export function draftAdopter(draftId: string, onView: (v: SetupDraftView) => void): LibraryAdopter {
  return {
    async adopt(ids, target) {
      const r = await addLibraryToDraftAction(draftId, { kind: "ADD_FROM_LIBRARY", ids, logframeCode: target.logframeCode ?? null });
      if (!r.ok) return { ok: false, message: r.error.message };
      onView(r.value);
      return { ok: true, value: { added: ids.length, skipped: [] } };
    },
    async adoptSkeleton(sectorId) {
      const r = await addLibraryToDraftAction(draftId, { kind: "ADD_FROM_SKELETON", sectorId });
      if (!r.ok) return { ok: false, message: r.error.message };
      onView(r.value);
      return { ok: true, value: { added: 1 } };
    },
  };
}
