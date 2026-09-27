"use client";

import { useRef, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";

type Item = {
  key: string;
  label: string;
  shortcut?: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
};

const svg = (path: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

const ICONS = {
  bold: <span className="font-sans text-[13px] font-bold">B</span>,
  italic: <span className="font-serif text-[14px] italic">I</span>,
  code: svg(<path d="M8 17l-5-5 5-5M16 7l5 5-5 5" />),
  h3: <span className="font-sans text-[12px] font-semibold">H3</span>,
  h4: <span className="font-sans text-[12px] font-semibold">H4</span>,
  bullet: svg(<><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>),
  ordered: svg(<><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 6h1v4M4 10h2M4 14.5c.6-.6 2-.6 2 .5 0 .8-2 1.5-2 3h2" /></>),
  quote: svg(<path d="M7 7h4v4c0 3-2 5-4 5M15 7h4v4c0 3-2 5-4 5" />),
  link: svg(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  table: svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 4v16" /></>),
  undo: svg(<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />),
  redo: svg(<path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />),
  clear: svg(<path d="M4 7V5h12v2M10 5l-3 14M14 19h-4M17 14l4 4M21 14l-4 4" />),
};

/**
 * Formatting toolbar for the section being edited. Every control maps to a
 * construct the exporters render (see rich-text/extensions.ts). Roving
 * tabindex: one Tab stop, arrow keys move between buttons.
 */
export function EditorToolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      code: e.isActive("code"),
      h3: e.isActive("heading", { level: 3 }),
      h4: e.isActive("heading", { level: 4 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const barRef = useRef<HTMLDivElement>(null);
  const chain = () => editor.chain().focus();

  const groups: Item[][] = [
    [
      { key: "bold", label: "Bold", shortcut: "Ctrl+B", icon: ICONS.bold, active: state.bold, run: () => chain().toggleBold().run() },
      { key: "italic", label: "Italic", shortcut: "Ctrl+I", icon: ICONS.italic, active: state.italic, run: () => chain().toggleItalic().run() },
      { key: "code", label: "Inline code", shortcut: "Ctrl+E", icon: ICONS.code, active: state.code, run: () => chain().toggleCode().run() },
      { key: "link", label: "Link", shortcut: "Ctrl+K", icon: ICONS.link, active: state.link, run: onLink },
    ],
    [
      { key: "h3", label: "Heading", icon: ICONS.h3, active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
      { key: "h4", label: "Subheading", icon: ICONS.h4, active: state.h4, run: () => chain().toggleHeading({ level: 4 }).run() },
      { key: "bullet", label: "Bulleted list", shortcut: "Ctrl+Shift+8", icon: ICONS.bullet, active: state.bullet, run: () => chain().toggleBulletList().run() },
      { key: "ordered", label: "Numbered list", shortcut: "Ctrl+Shift+7", icon: ICONS.ordered, active: state.ordered, run: () => chain().toggleOrderedList().run() },
      { key: "quote", label: "Quote", icon: ICONS.quote, active: state.quote, run: () => chain().toggleBlockquote().run() },
      {
        key: "table",
        label: "Insert table",
        icon: ICONS.table,
        disabled: state.table,
        run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
    ],
    [
      { key: "clear", label: "Clear formatting", icon: ICONS.clear, run: () => chain().unsetAllMarks().clearNodes().run() },
      { key: "undo", label: "Undo", shortcut: "Ctrl+Z", icon: ICONS.undo, disabled: !state.canUndo, run: () => chain().undo().run() },
      { key: "redo", label: "Redo", shortcut: "Ctrl+Shift+Z", icon: ICONS.redo, disabled: !state.canRedo, run: () => chain().redo().run() },
    ],
  ];

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const buttons = Array.from(barRef.current?.querySelectorAll<HTMLButtonElement>("button[data-tool]:not(:disabled)") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  let first = true;
  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-slate-900"
    >
      {groups.map((group, gi) => (
        <div key={gi} className={`flex items-center gap-0.5 ${gi > 0 ? "border-l border-slate-200 pl-1 dark:border-white/10" : ""}`}>
          {group.map((item) => {
            const tabIndex = first && !item.disabled ? 0 : -1;
            if (tabIndex === 0) first = false;
            return (
              <button
                key={item.key}
                type="button"
                data-tool={item.key}
                tabIndex={tabIndex}
                title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
                aria-label={item.label}
                aria-pressed={item.active === undefined ? undefined : item.active}
                disabled={item.disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={item.run}
                className={`flex h-8 min-w-[32px] items-center justify-center rounded-md px-1.5 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-white/10 ${
                  item.active ? "bg-brand-500/15 text-brand-700 dark:text-brand-300" : ""
                }`}
              >
                {item.icon}
              </button>
            );
          })}
        </div>
      ))}
      {state.table && <TableControls editor={editor} />}
    </div>
  );
}

function TableControls({ editor }: { editor: Editor }) {
  const chain = () => editor.chain().focus();
  const actions: Array<[string, () => void, boolean?]> = [
    ["Row above", () => chain().addRowBefore().run()],
    ["Row below", () => chain().addRowAfter().run()],
    ["Column left", () => chain().addColumnBefore().run()],
    ["Column right", () => chain().addColumnAfter().run()],
    ["Delete row", () => chain().deleteRow().run()],
    ["Delete column", () => chain().deleteColumn().run()],
    ["Header row", () => chain().toggleHeaderRow().run()],
    ["Delete table", () => chain().deleteTable().run(), true],
  ];
  return (
    <div role="group" aria-label="Table" className="flex w-full flex-wrap items-center gap-1 border-t border-slate-200 pt-1 dark:border-white/10">
      <span className="px-1 text-xs font-medium text-slate-500 dark:text-slate-400">Table:</span>
      {actions.map(([label, run, danger]) => (
        <button
          key={label}
          type="button"
          data-tool={`table-${label}`}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          className={`h-7 rounded-md px-2 text-xs transition hover:bg-slate-100 dark:hover:bg-white/10 ${
            danger ? "text-danger-700 dark:text-danger-400" : "text-slate-700 dark:text-slate-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
