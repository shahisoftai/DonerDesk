import { messageBlocks } from "@donordesk/domain/core/message-blocks.js";
import { cn } from "./cn";

/** A notification or reminder message: headings, bullet lists and paragraphs, read by the one domain rule (`messageBlocks`). */
export function MessageBody({ text, className }: { text: string; className?: string }) {
  const blocks = messageBlocks(text);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("space-y-1 text-sm text-slate-600 dark:text-slate-400", className)}>
      {blocks.map((b, i) =>
        b.kind === "LIST" ? (
          <ul key={i} className="list-disc space-y-0.5 ps-5">
            {b.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        ) : b.kind === "HEADING" ? (
          <p key={i} className="pt-1 font-medium text-slate-800 dark:text-slate-200">{b.text}</p>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
}
