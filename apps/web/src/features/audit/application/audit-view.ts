export interface AuditRecord {
  id: string;
  actorId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  projectId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  systemNote?: string;
  createdAt: string | Date;
}

export type AuditFilter = {
  actorId?: string;
  eventType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
};

/**
 * Masks common sensitive patterns (email addresses, phone numbers, and long
 * opaque tokens) so the audit summary never renders raw PII or secrets.
 */
export function redactSensitive(input: string): string {
  const email = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let out = input.replace(email, (_, local: string) => `${local.slice(0, 2)}***@***`);
  const phone = /(\+?\d[\d\s().-]{6,}\d)/g;
  out = out.replace(phone, (m: string) => `${m.slice(0, 3)}***`);
  const token = /([A-Za-z0-9_-]{24,})/g;
  out = out.replace(token, (m: string) => `${m.slice(0, 6)}…`);
  return out;
}

/** Builds a short, readable, redacted summary of a change's old/new values. */
export function readableChange(record: AuditRecord): string {
  const parts: string[] = [];
  if (record.oldValue) parts.push(`from ${redactSensitive(record.oldValue)}`);
  if (record.newValue) parts.push(`to ${redactSensitive(record.newValue)}`);
  if (parts.length === 0) return "no detail";
  return parts.join(" ");
}

/** Filters audit records by optional actor, event type, entity id, and date range. */
export function filterAudit(records: AuditRecord[], filter: AuditFilter): AuditRecord[] {
  return records.filter((r) => {
    if (filter.actorId && r.actorId !== filter.actorId) return false;
    if (filter.eventType && r.eventType !== filter.eventType) return false;
    if (filter.entityId && r.entityId !== filter.entityId) return false;
    const date = new Date(r.createdAt);
    if (filter.dateFrom && date.getTime() < new Date(filter.dateFrom).getTime()) return false;
    if (filter.dateTo) {
      const end = new Date(filter.dateTo);
      end.setHours(23, 59, 59, 999);
      if (date.getTime() > end.getTime()) return false;
    }
    return true;
  });
}

/** Paginates a filtered array in memory. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
