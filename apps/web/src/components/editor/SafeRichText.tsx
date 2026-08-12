export function SafeRichText({ content }: { content: string }) {
  // Rendered as text with preserved whitespace; never injects HTML.
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed" data-safe-rich-text>
      {content}
    </div>
  );
}
