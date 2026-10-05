import { Badge } from "@/components/data/Badge";

export type SemanticsSummary = { summary: string; needsReview: boolean };

/** How an indicator is calculated, in one badge: "Needs review" until a person confirms it. */
export function SemanticsBadge({ description }: { description?: SemanticsSummary | null }) {
  if (!description) return null;
  return (
    <Badge tone={description.needsReview ? "warning" : "success"} title={description.summary}>
      {description.needsReview ? "Calculation needs review" : "Calculation confirmed"}
    </Badge>
  );
}
