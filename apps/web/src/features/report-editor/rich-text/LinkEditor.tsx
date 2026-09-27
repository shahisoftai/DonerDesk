"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/Button";

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

/** Normalises what a user typed into a safe link, or null when unusable. */
export function normaliseLinkInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (SAFE_URL.test(value)) return value;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(value)) return `mailto:${value}`;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)) return `https://${value}`;
  return null;
}

/** Small inline form to add, change or remove the link on the selection. */
export function LinkEditor({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const current = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => inputRef.current?.focus(), []);

  function apply() {
    const href = normaliseLinkInput(value);
    if (!href) {
      setError("Enter a web address (https://…) or an email address.");
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    onClose();
  }

  function remove() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <label htmlFor={id} className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        Link address
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="url"
          value={value}
          placeholder="https://example.org"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
              editor.commands.focus();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal dark:border-white/15 dark:bg-white/5"
        />
      </label>
      <Button size="sm" onClick={apply}>
        {current ? "Update" : "Add link"}
      </Button>
      {current && (
        <Button size="sm" variant="ghost" onClick={remove}>
          Remove
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      {error && (
        <p id={`${id}-error`} role="alert" className="w-full text-xs text-danger-700 dark:text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}
