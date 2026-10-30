"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";

/** While editing: add a note, or a section heading that groups the tiles under it. A heading is added full width and short; a note is a block of plain text. */
export function AddNotePanel({ projects, onAdd, full }: { projects: Record<string, string>; onAdd: (projectId: string, text: string, heading: boolean) => void; full: boolean }) {
  const ids = Object.keys(projects);
  const [text, setText] = useState("");
  const [heading, setHeading] = useState(true);
  if (ids.length === 0) return null;
  return (
    <form aria-label="Add a note or heading" className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10"
      onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (!t) return; onAdd(ids[0]!, heading ? `# ${t.replace(/\s+/g, " ")}` : t, heading); setText(""); }}>
      <h3 className="text-sm font-medium">Add a note or heading</h3>
      <Field label={heading ? "Heading" : "Note"} description="A heading groups the tiles under it; a note is plain text."><Textarea rows={heading ? 1 : 3} maxLength={heading ? 120 : 2000} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={heading} onChange={(e) => setHeading(e.target.checked)} /> Make it a section heading</label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={full || text.trim() === ""}>{heading ? "Add the heading" : "Add the note"}</Button>
        {full && <span className="text-xs text-slate-500">This dashboard is full.</span>}
      </div>
    </form>
  );
}
