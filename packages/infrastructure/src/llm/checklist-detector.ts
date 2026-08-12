import type { IChecklistDetector } from "@donordesk/application";
import type { ChecklistItemType, Severity } from "@donordesk/domain";

export class StubChecklistDetector implements IChecklistDetector {
  async detect(input: Parameters<IChecklistDetector["detect"]>[0]): ReturnType<IChecklistDetector["detect"]> {
    const out: Array<{ type: ChecklistItemType; title: string; description: string; severity: Severity; relatedEntityType?: string; relatedEntityId?: string }> = [];

    for (const annex of input.requiredAnnexes) {
      out.push({
        type: "MISSING_ANNEX",
        title: `Annex required: ${annex}`,
        description: `Donor template requires annex "${annex}". Confirm attachment before submission.`,
        severity: "MEDIUM",
      });
    }

    if (input.totalIndicatorCount > 0 && input.verifiedIndicatorCount < input.totalIndicatorCount) {
      const remaining = input.totalIndicatorCount - input.verifiedIndicatorCount;
      out.push({
        type: "UNVERIFIED_INDICATOR",
        title: `${remaining} indicator update${remaining === 1 ? "" : "s"} pending verification`,
        description: "M&E officer must verify indicator data before submission.",
        severity: "HIGH",
      });
    }

    if (input.activitiesCount === 0) {
      out.push({
        type: "LATE_ACTIVITY_UPDATE",
        title: "No activity updates submitted for this period",
        description: "Field officers should submit at least one activity update per reporting period.",
        severity: "HIGH",
      });
    }

    if (input.evidenceCount < input.requiredEvidenceCount) {
      out.push({
        type: "MISSING_EVIDENCE",
        title: `Only ${input.evidenceCount} evidence file${input.evidenceCount === 1 ? "" : "s"} uploaded`,
        description: `Donor template and logframe require approximately ${input.requiredEvidenceCount} evidence files.`,
        severity: "HIGH",
      });
    }

    for (const sec of input.sectionStatuses) {
      if (sec.hasUnsupportedClaims) {
        out.push({
          type: "UNSUPPORTED_REPORT_CLAIM",
          title: "Report section contains unsupported claims",
          description: "Review claims flagged as 'Needs source verification' before approval.",
          severity: "MEDIUM",
          relatedEntityType: "report_section",
          relatedEntityId: sec.sectionId,
        });
      }
      if (sec.status === "NEEDS_EVIDENCE") {
        out.push({
          type: "INCOMPLETE_EVIDENCE_METADATA",
          title: "Section blocked on evidence",
          description: "Section cannot be drafted until supporting evidence is uploaded.",
          severity: "MEDIUM",
          relatedEntityType: "report_section",
          relatedEntityId: sec.sectionId,
        });
      }
    }

    return out;
  }
}
