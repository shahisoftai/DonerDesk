import Link from "next/link";

const HELP_TOPICS = {
  templates: { href: "/support/how-to/upload-donor-template", label: "How donor templates work" },
  "report-editor": { href: "/support/how-to/use-the-report-editor", label: "How the report editor works" },
  compliance: { href: "/support/how-to/use-compliance-checklist", label: "How compliance checks work" },
} as const;

export type HelpTopic = keyof typeof HELP_TOPICS;

/**
 * Small contextual help link (Feature 22 Phase 4) deep-linking into the
 * existing `support/*` article section rather than opening a new content
 * system. Opens in a new tab so it doesn't lose the user's place mid-task.
 */
export function HelpButton({ topic }: { topic: HelpTopic }) {
  const { href, label } = HELP_TOPICS[topic];
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
      aria-label={`Help: ${label}`}
    >
      <span aria-hidden="true">?</span>
      Help
    </Link>
  );
}
