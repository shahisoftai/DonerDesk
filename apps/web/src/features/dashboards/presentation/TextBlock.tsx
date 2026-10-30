/**
 * A note on a dashboard. A line that starts with "# " is a section heading (after the way DevResults dashboards group tiles under a markdown text tile); every other
 * line is plain text. Nothing else is interpreted, so a note can never carry markup.
 */
export function TextBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 p-3 text-sm" data-testid="text-widget">
      {lines.map((line, i) => /^#\s+/.test(line)
        ? <h3 key={i} className="text-base font-semibold">{line.replace(/^#\s+/, "")}</h3>
        : <p key={i} className="whitespace-pre-wrap">{line}</p>)}
    </div>
  );
}
