export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "failed" | "conflict";

export interface AutosaveState {
  status: AutosaveStatus;
  /** Current text shown in the editor. */
  text: string;
  /** Last text known to be persisted on the server. */
  savedText: string;
  /** Last server version token (section updatedAt). */
  version: string;
  /** Human-readable message for failed/conflict states. */
  error?: string;
  /** Unsaved local copy preserved for recovery after a conflict. */
  recovery?: string;
}

export type AutosaveAction =
  | { type: "init"; text: string; version: string }
  | { type: "input"; text: string }
  | { type: "save-start" }
  | { type: "save-success"; version: string }
  | { type: "save-fail"; error: string }
  | { type: "conflict"; error: string }
  | { type: "discard-local" }
  | { type: "acknowledge" };

export function createAutosaveState(text: string, version: string): AutosaveState {
  return { status: "idle", text, savedText: text, version };
}

export function autosaveReducer(state: AutosaveState, action: AutosaveAction): AutosaveState {
  switch (action.type) {
    case "init":
      return createAutosaveState(action.text, action.version);
    case "input":
      return {
        ...state,
        text: action.text,
        status: action.text === state.savedText ? "idle" : "dirty",
      };
    case "save-start":
      return { ...state, status: "saving", error: undefined };
    case "save-success":
      return {
        status: "saved",
        text: state.text,
        savedText: state.text,
        version: action.version,
      };
    case "save-fail":
      return { ...state, status: "failed", error: action.error };
    case "conflict":
      return { ...state, status: "conflict", error: action.error, recovery: state.text };
    case "discard-local":
      return { status: "idle", text: state.savedText, savedText: state.savedText, version: state.version };
    case "acknowledge":
      return { ...state, error: undefined };
    default:
      return state;
  }
}

export function isDirty(state: AutosaveState): boolean {
  return state.status === "dirty" || state.status === "saving" || state.status === "failed";
}
