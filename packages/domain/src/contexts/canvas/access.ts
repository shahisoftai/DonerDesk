/**
 * Who may see and change a canvas (Phase 45.3): the dashboards' rules, stated once for canvases. A personal canvas is its owner's
 * and to anyone else it does not exist; a shared one (organisation, project, portfolio) is seen by any member, whose charts still
 * obey project access; it is changed by its owner and by anyone who manages shared work, and only such a person makes one.
 */
import type { CanvasScope } from "./canvas.js";

export interface CanvasAccessFacts { scope: CanvasScope; ownerId: string; projectId?: string | undefined }
export interface CanvasViewer { userId: string; canManageShared: boolean }

export const canSeeCanvas = (c: CanvasAccessFacts, viewer: Pick<CanvasViewer, "userId">): boolean => c.scope !== "MINE" || c.ownerId === viewer.userId;
export const canEditCanvas = (c: CanvasAccessFacts, viewer: CanvasViewer): boolean => c.ownerId === viewer.userId || (c.scope !== "MINE" && viewer.canManageShared);
export const canCreateCanvas = (scope: CanvasScope, viewer: Pick<CanvasViewer, "canManageShared">): boolean => scope === "MINE" || viewer.canManageShared;

/** A project canvas names its project; the other kinds do not. */
export function canvasScopeProblem(c: Pick<CanvasAccessFacts, "scope" | "projectId">): string | null {
  if (c.scope === "PROJECT" && !c.projectId) return "A project canvas needs a project.";
  if (c.scope !== "PROJECT" && c.projectId) return "Only a project canvas belongs to one project.";
  return null;
}
