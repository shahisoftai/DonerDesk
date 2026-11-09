/**
 * What clicking a block can do (Phase 48.3): set a parameter, open another page or canvas, follow an in-app link or open the table behind
 * the block. An action only names a destination; it never runs code and never calls out of the product. Pure: validation, and the change
 * an action asks for (`runAction`), which the screen then applies.
 */
import type { CanvasParameter, ParamValue } from "./params.js";
import { isValueOfKind } from "./params.js";
import { isInAppAddress } from "../bookmarks/index.js";

export type BlockAction =
  | { type: "SET_PARAM"; param: string; /** A fixed value, or taken from what was clicked. */ value: ParamValue | "CLICKED_LABEL" }
  | { type: "OPEN_PAGE"; pageId: string }
  | { type: "OPEN_CANVAS"; canvasId: string; params?: Record<string, ParamValue> | undefined }
  | { type: "OPEN_LINK"; href: string }
  | { type: "OPEN_TABLE" };

export const ACTION_TYPES = ["SET_PARAM", "OPEN_PAGE", "OPEN_CANVAS", "OPEN_LINK", "OPEN_TABLE"] as const;


export function actionProblems(action: BlockAction, canvas: { pageIds: ReadonlySet<string>; params: ReadonlyArray<CanvasParameter> }): string[] {
  switch (action.type) {
    case "SET_PARAM": {
      const p = canvas.params.find((x) => x.id === action.param);
      if (!p) return ["This click sets a parameter that does not exist."];
      return action.value === "CLICKED_LABEL" || isValueOfKind(p.kind, action.value) ? [] : ["The value does not fit that parameter."];
    }
    case "OPEN_PAGE": return canvas.pageIds.has(action.pageId) ? [] : ["This click opens a page that does not exist."];
    case "OPEN_CANVAS": return /^[A-Za-z0-9_-]{1,64}$/.test(action.canvasId) ? [] : ["This click opens a canvas by a name that cannot be right."];
    case "OPEN_LINK": return isInAppAddress(action.href) ? [] : ["A link must be an address inside the product (it starts with a single /)."];
    case "OPEN_TABLE": return [];
    default: return ["Unknown action."];
  }
}

export interface ActionEffect { params?: Record<string, ParamValue>; page?: string; navigate?: { canvasId: string; params: Record<string, ParamValue> } | { href: string }; showTable?: true }

/** The change an action asks for; an action that cannot apply (a clicked label with nothing clicked) asks for nothing. */
export function runAction(action: BlockAction, clickedLabel: string | undefined): ActionEffect {
  switch (action.type) {
    case "SET_PARAM": {
      const value = action.value === "CLICKED_LABEL" ? (clickedLabel ?? null) : action.value;
      return value === null && action.value === "CLICKED_LABEL" ? {} : { params: { [action.param]: value } };
    }
    case "OPEN_PAGE": return { page: action.pageId };
    case "OPEN_CANVAS": return { navigate: { canvasId: action.canvasId, params: action.params ?? {} } };
    case "OPEN_LINK": return isInAppAddress(action.href) ? { navigate: { href: action.href } } : {};
    case "OPEN_TABLE": return { showTable: true };
  }
}
