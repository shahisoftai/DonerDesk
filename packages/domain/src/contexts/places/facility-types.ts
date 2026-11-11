/**
 * Facility types (Phase 50.3b): what kind of service point a place is (an outpatient therapeutic programme site, a stabilisation centre,
 * a school). An organisation keeps its own list; a starting list per sector is offered, never imposed. A type is set only on a place
 * marked as a facility, and a count of facilities by type reads only typed facilities (an untyped one is counted apart, never guessed).
 */
export const FACILITY_TYPE_MAX = 40;
export const FACILITY_TYPES_MAX = 40;
export interface FacilityType { key: string; label: string; sector?: string | undefined }

/** Starting lists by sector library key; a person picks from these and may add their own. */
export const SUGGESTED_FACILITY_TYPES: Readonly<Record<string, readonly FacilityType[]>> = {
  NUTRITION: [{ key: "OTP", label: "Outpatient therapeutic programme (OTP)" }, { key: "SC", label: "Stabilisation centre (SC)" }, { key: "TSFP", label: "Targeted supplementary feeding (TSFP/SFP)" }, { key: "BSFP", label: "Blanket supplementary feeding (BSFP)" }],
  HEALTH: [{ key: "PHC", label: "Primary health care unit" }, { key: "HOSPITAL", label: "Hospital" }, { key: "MOBILE_CLINIC", label: "Mobile clinic" }],
  EDUCATION: [{ key: "SCHOOL", label: "School" }, { key: "TLS", label: "Temporary learning space" }],
  WASH: [{ key: "WATER_POINT", label: "Water point" }, { key: "LATRINE_BLOCK", label: "Latrine block" }],
  PROTECTION: [{ key: "SAFE_SPACE", label: "Safe space" }, { key: "CFS", label: "Child-friendly space" }],
  FOOD_SECURITY: [{ key: "DISTRIBUTION_POINT", label: "Distribution point" }],
};

export const normalizeFacilityTypeKey = (s: string): string => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

export function facilityTypeProblem(place: { facility?: boolean | undefined; facilityType?: string | undefined }): string | null {
  if (place.facilityType === undefined) return null;
  if (!place.facility) return "Only a place marked as a facility has a facility type";
  const k = normalizeFacilityTypeKey(place.facilityType);
  if (!k || k.length > FACILITY_TYPE_MAX) return `A facility type is 1 to ${FACILITY_TYPE_MAX} letters or digits`;
  return null;
}

export function facilityTypeListProblems(list: readonly FacilityType[]): string[] {
  const out: string[] = [];
  if (list.length > FACILITY_TYPES_MAX) out.push(`At most ${FACILITY_TYPES_MAX} facility types.`);
  const seen = new Set<string>();
  for (const t of list) {
    const k = normalizeFacilityTypeKey(t.key);
    if (!k || k !== t.key) out.push("A facility type's key is capital letters, digits and _.");
    if (!t.label.trim() || t.label.length > 80) out.push("A facility type's name is 1 to 80 characters.");
    if (seen.has(k)) out.push("Two facility types share a key.");
    seen.add(k);
  }
  return [...new Set(out)];
}
