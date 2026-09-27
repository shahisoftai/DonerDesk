import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import type { AnyExtension } from "@tiptap/core";

/**
 * The report editor's schema — deliberately limited to the markdown subset
 * every exporter renders (see packages/domain `section-markdown.ts` and
 * packages/infrastructure `exports/markdown-renderer.ts`): paragraphs,
 * H3/H4, bullet and numbered lists, block quotes, GFM tables, bold, italic,
 * inline code and links. Anything the exporters cannot render (underline,
 * strike, code blocks, horizontal rules, hard breaks, images) is disabled so
 * the editor can never produce it.
 *
 * React-free so the same list drives the editor and the headless round-trip
 * tests.
 */
export function reportEditorExtensions(extra: AnyExtension[] = []): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [3, 4] },
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      hardBreak: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    TableKit.configure({ table: { resizable: false } }),
    Markdown.configure({ indentation: { style: "space", size: 2 } }),
    ...extra,
  ];
}
