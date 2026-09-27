import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { searchIndex } from "../application/claim-anchors.ts";
import type { HighlightTone } from "../application/highlight-hast.ts";

/**
 * Checked statements marked inside the rich-text editor (Report Editor §4.5):
 * ProseMirror decorations, found by searching each paragraph's text for the
 * statement (markup-, case- and whitespace-insensitive). They are recomputed
 * on every edit, so a mark follows its text and disappears once the text is
 * changed. Decorations never enter the document, so they can never be saved.
 * React-free so the decoration logic is unit-tested headlessly.
 */

export type EditorHighlight = { claimId: string; text: string; tone: HighlightTone };

export const claimHighlightsKey = new PluginKey<DecorationSet>("claimHighlights");

export function buildClaimDecorations(doc: PMNode, highlights: ReadonlyArray<EditorHighlight>): DecorationSet {
  const decorations: Decoration[] = [];
  const pending = new Map(highlights.map((h) => [h.claimId, { h, needle: searchIndex(h.text).text }]));
  doc.descendants((node, pos) => {
    if (pending.size === 0) return false;
    if (!node.isTextblock) return true;
    const index = searchIndex(node.textContent);
    for (const [id, { h, needle }] of pending) {
      if (!needle) {
        pending.delete(id);
        continue;
      }
      const at = index.text.indexOf(needle);
      if (at === -1) continue;
      // Our schema has no inline atoms, so text offset i sits at pos + 1 + i.
      const from = pos + 1 + index.offsets[at]!;
      const to = pos + 1 + index.offsets[at + needle.length - 1]! + 1;
      decorations.push(Decoration.inline(from, to, { class: "claim-mark", "data-claim-id": id, "data-claim-state": h.tone }));
      pending.delete(id);
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

type ClaimHighlightsStorage = { highlights: ReadonlyArray<EditorHighlight> };

declare module "@tiptap/core" {
  interface Storage {
    claimHighlights: ClaimHighlightsStorage;
  }
}

export const ClaimHighlights = Extension.create<Record<string, never>, ClaimHighlightsStorage>({
  name: "claimHighlights",
  addStorage() {
    return { highlights: [] };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin<DecorationSet>({
        key: claimHighlightsKey,
        state: {
          init: (_config, state) => buildClaimDecorations(state.doc, storage.highlights),
          apply: (tr, previous, _old, next) =>
            tr.docChanged || tr.getMeta(claimHighlightsKey) ? buildClaimDecorations(next.doc, storage.highlights) : previous,
        },
        props: {
          decorations: (state) => claimHighlightsKey.getState(state),
        },
      }),
    ];
  },
});

/** Replaces the marked statements (a meta-only transaction: never saved). */
export function setClaimHighlights(editor: Editor, highlights: ReadonlyArray<EditorHighlight>): void {
  editor.storage.claimHighlights.highlights = highlights;
  editor.view.dispatch(editor.state.tr.setMeta(claimHighlightsKey, true));
}
