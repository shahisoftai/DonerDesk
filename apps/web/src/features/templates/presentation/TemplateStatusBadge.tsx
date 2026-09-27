import { Badge } from "@/components/data/Badge";
import type { Tone } from "@/lib/shared/tone";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  EXTRACTING: { label: "Analysing…", tone: "ai" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warning" },
  REVIEWED: { label: "Reviewed", tone: "success" },
  EXTRACTION_FAILED: { label: "Extraction failed", tone: "danger" },
};

const METHOD: Record<string, { label: string; tone: Tone; title: string }> = {
  LLM: { label: "AI extracted", tone: "ai", title: "Extracted by AI and verified against the template text" },
  HEURISTIC: { label: "Rule-based", tone: "info", title: "Extracted from the document's headings and wording (no AI)" },
  CANONICAL: { label: "Generic outline", tone: "danger", title: "No structure was detected; a generic outline was proposed" },
  MANUAL: { label: "Manual", tone: "neutral", title: "Authored manually" },
};

export function TemplateStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ExtractionMethodBadge({ method }: { method?: string }) {
  if (!method) return null;
  const m = METHOD[method];
  if (!m) return null;
  return <Badge tone={m.tone} title={m.title}>{m.label}</Badge>;
}
