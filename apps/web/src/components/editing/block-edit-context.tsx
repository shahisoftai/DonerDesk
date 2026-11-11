"use client";

import { createContext, useContext } from "react";

/**
 * Lets something drawn inside a block change that block's own settings while the canvas is being edited (Phase 50.3d: dragging a card on
 * a map). The workspace provides the change function only in edit mode; a block names itself. Outside editing there is nothing to call.
 */
type Update = (blockId: string, change: (props: unknown) => unknown) => void;
const EditorUpdate = createContext<Update | null>(null);
const BlockId = createContext<string | null>(null);
export const BlockEditProvider = EditorUpdate.Provider;
export const BlockIdProvider = BlockId.Provider;

/** The change function for the block this is drawn in, or null when the canvas is not being edited. */
export function useBlockEdit(): ((change: (props: unknown) => unknown) => void) | null {
  const update = useContext(EditorUpdate), id = useContext(BlockId);
  return update && id ? (change) => update(id, change) : null;
}
