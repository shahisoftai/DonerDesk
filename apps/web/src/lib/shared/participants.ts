export interface ParticipantBreakdown {
  participantsTotal?: number | null;
  participantsMale?: number | null;
  participantsFemale?: number | null;
  participantsChildren?: number | null;
  participantsDisability?: number | null;
}

export type ParticipantFieldErrors = Record<string, string[]>;

/**
 * Validates that disaggregation categories do not exceed the reported total.
 * Returns field-keyed error messages; an empty object means valid.
 */
export function validateParticipantBreakdown(input: ParticipantBreakdown): ParticipantFieldErrors {
  const errors: ParticipantFieldErrors = {};
  const total = toNonNegative(input.participantsTotal);

  if (input.participantsTotal !== undefined && input.participantsTotal !== null && input.participantsTotal < 0) {
    errors.participantsTotal = ["Total participants cannot be negative."];
    return errors;
  }

  const checks: Array<{ key: keyof ParticipantBreakdown; label: string }> = [
    { key: "participantsMale", label: "Male participants" },
    { key: "participantsFemale", label: "Female participants" },
    { key: "participantsChildren", label: "Child participants" },
    { key: "participantsDisability", label: "Participants with disability" },
  ];

  for (const check of checks) {
    const value = toNonNegative(input[check.key]);
    if (value !== undefined && value < 0) {
      errors[check.key as string] = [`${check.label} cannot be negative.`];
    }
  }
  if (Object.keys(errors).length > 0) return errors;

  if (total !== undefined) {
    const male = toNonNegative(input.participantsMale);
    const female = toNonNegative(input.participantsFemale);
    if (male !== undefined && female !== undefined && male + female > total) {
      errors.participantsMale = ["Male + Female participants exceed the total."];
      errors.participantsFemale = ["Male + Female participants exceed the total."];
    }
    for (const check of checks) {
      const value = toNonNegative(input[check.key]);
      if (value !== undefined && value > total) {
        errors[check.key as string] = [`${check.label} cannot exceed the total (${total}).`];
      }
    }
  }

  return errors;
}

function toNonNegative(value: number | null | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  return value;
}
