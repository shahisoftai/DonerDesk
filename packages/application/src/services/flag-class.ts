import { classifyFlag, type FlagClass, type ReportClaim } from "@donordesk/domain";

/** The flag class of a stored claim (presentation only; see `classifyFlag`). */
export function flagClassOf(c: Pick<ReportClaim, "verificationReasonCode" | "assertionType" | "type" | "materiality" | "numericAtoms">): FlagClass {
  return classifyFlag({
    verificationReasonCode: c.verificationReasonCode,
    assertionType: c.assertionType,
    type: c.type,
    materiality: c.materiality,
    hasNumericAtoms: c.numericAtoms.length > 0,
  }).class;
}
