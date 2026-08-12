import type { IEvidenceTagger } from "@donordesk/application";
import type { SuggestedTag } from "@donordesk/domain";

const KEYWORDS: Record<string, { evidenceType: string; confidence: "HIGH" | "MEDIUM" | "LOW" }> = {
  attendance: { evidenceType: "ATTENDANCE_SHEET", confidence: "HIGH" },
  photo: { evidenceType: "PHOTO", confidence: "HIGH" },
  picture: { evidenceType: "PHOTO", confidence: "HIGH" },
  distribution: { evidenceType: "DISTRIBUTION_LIST", confidence: "HIGH" },
  training: { evidenceType: "TRAINING_RECORD", confidence: "MEDIUM" },
  visit: { evidenceType: "FIELD_VISIT_REPORT", confidence: "MEDIUM" },
  monitoring: { evidenceType: "MONITORING_REPORT", confidence: "MEDIUM" },
  kobo: { evidenceType: "KOBO_ODK_EXPORT", confidence: "HIGH" },
  odk: { evidenceType: "KOBO_ODK_EXPORT", confidence: "HIGH" },
  procurement: { evidenceType: "PROCUREMENT_DOCUMENT", confidence: "MEDIUM" },
  approval: { evidenceType: "APPROVAL_DOCUMENT", confidence: "MEDIUM" },
  beneficiary: { evidenceType: "BENEFICIARY_LIST", confidence: "HIGH" },
  minutes: { evidenceType: "MEETING_MINUTES", confidence: "MEDIUM" },
  case: { evidenceType: "CASE_STUDY", confidence: "LOW" },
  financial: { evidenceType: "FINANCIAL_DOCUMENT", confidence: "MEDIUM" },
  invoice: { evidenceType: "FINANCIAL_DOCUMENT", confidence: "HIGH" },
  supplier: { evidenceType: "SUPPLIER_DOCUMENT", confidence: "MEDIUM" },
};

const SENSITIVE_KEYWORDS = ["beneficiary name", "phone", "cnic", "national id", "passport", "children", "medical", "diagnosis", "patient"];

export class StubEvidenceTagger implements IEvidenceTagger {
  async suggestTags(input: { fileName: string; fileType: string; extractedText?: string; existingProjectName?: string; existingActivities: Array<{ id: string; title: string }>; existingIndicators: Array<{ id: string; code: string; name: string }>; }): Promise<{ summary: string; tags: SuggestedTag[]; sensitivityWarning?: string; model: string }> {
    const haystack = `${input.fileName}\n${input.extractedText ?? ""}`.toLowerCase();
    const tags: SuggestedTag[] = [];
    let matchedType: { evidenceType: string; confidence: "HIGH" | "MEDIUM" | "LOW" } | undefined;

    for (const [keyword, info] of Object.entries(KEYWORDS)) {
      if (haystack.includes(keyword)) {
        if (!matchedType || info.confidence === "HIGH") matchedType = { evidenceType: info.evidenceType, confidence: info.confidence };
      }
    }
    if (matchedType) {
      tags.push({ field: "evidenceType", value: matchedType.evidenceType, confidence: matchedType.confidence, accepted: false });
    } else {
      tags.push({ field: "evidenceType", value: "OTHER", confidence: "LOW", accepted: false });
    }

    for (const a of input.existingActivities.slice(0, 5)) {
      if (haystack.includes(a.title.toLowerCase().slice(0, 6))) {
        tags.push({ field: "activityId", value: a.id, confidence: "MEDIUM", accepted: false });
        break;
      }
    }
    for (const ind of input.existingIndicators.slice(0, 5)) {
      const code = ind.code.toLowerCase();
      const name = ind.name.toLowerCase().slice(0, 8);
      if (haystack.includes(code) || haystack.includes(name)) {
        tags.push({ field: "indicatorId", value: ind.id, confidence: "MEDIUM", accepted: false });
        break;
      }
    }

    const hits = SENSITIVE_KEYWORDS.filter((k) => haystack.includes(k));
    const sensitivityWarning =
      hits.length > 0
        ? `This file may contain sensitive personal data (${hits.slice(0, 3).join(", ")}). Please verify access level before sharing or exporting.`
        : undefined;

    const summary = `Suggested classification based on filename and extracted text. ${tags.length} suggestions ready for review.`;
    return { summary, tags, sensitivityWarning, model: "stub-v1" };
  }
}
