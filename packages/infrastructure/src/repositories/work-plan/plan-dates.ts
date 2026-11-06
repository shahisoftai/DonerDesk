import type { PlainDate } from "@donordesk/domain";

/** Plan dates are stored as DATE: always a UTC midnight Date in, a "YYYY-MM-DD" out. */
export const toDate = (d: PlainDate): Date => new Date(`${d}T00:00:00.000Z`);

export const toDay = (d: Date): PlainDate => d.toISOString().slice(0, 10);
