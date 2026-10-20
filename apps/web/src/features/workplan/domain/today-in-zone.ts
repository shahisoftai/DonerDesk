/** The calendar day (YYYY-MM-DD) in an IANA time zone; an unknown or missing zone reads as UTC. */
export function todayInZone(now: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
