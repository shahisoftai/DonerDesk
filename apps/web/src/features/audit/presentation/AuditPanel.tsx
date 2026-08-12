"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/data/Badge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { formatDateTime } from "@/lib/shared/dates";
import {
  filterAudit,
  paginate,
  readableChange,
  type AuditRecord,
} from "@/features/audit/application/audit-view";

const PAGE_SIZE = 25;

export function AuditPanel({ records }: { records: AuditRecord[] }) {
  const [actorId, setActorId] = useState("");
  const [eventType, setEventType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const eventTypes = useMemo(() => Array.from(new Set(records.map((r) => r.eventType))).sort(), [records]);
  const actorIds = useMemo(() => Array.from(new Set(records.map((r) => r.actorId))).sort(), [records]);

  const filtered = useMemo(
    () =>
      filterAudit(records, {
        actorId: actorId || undefined,
        eventType: eventType || undefined,
        entityId: entityId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [records, actorId, eventType, entityId, dateFrom, dateTo],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = useMemo(() => paginate(filtered, currentPage, PAGE_SIZE), [filtered, currentPage]);

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="audit-event">Event</label>
          <Select id="audit-event" value={eventType} onChange={(e) => { setEventType(e.target.value); resetPage(); }}>
            <option value="">All events</option>
            {eventTypes.map((t) => <option key={t} value={t}>{t.replace(/\./g, " · ")}</option>)}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="audit-actor">Actor</label>
          <Select id="audit-actor" value={actorId} onChange={(e) => { setActorId(e.target.value); resetPage(); }}>
            <option value="">All actors</option>
            {actorIds.map((a) => <option key={a} value={a}>User {a.slice(0, 8)}</option>)}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="audit-entity">Entity ID</label>
          <Input id="audit-entity" value={entityId} onChange={(e) => { setEntityId(e.target.value); resetPage(); }} placeholder="Filter by entity" />
        </div>
        <div>
          <label className="label" htmlFor="audit-from">From</label>
          <Input id="audit-from" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage(); }} />
        </div>
        <div>
          <label className="label" htmlFor="audit-to">To</label>
          <Input id="audit-to" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage(); }} />
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400">{filtered.length} record(s).</p>

      {rows.length === 0 ? (
        <div className="card text-sm text-slate-600 dark:text-slate-300">No audit records match these filters.</div>
      ) : (
        <div className="table-shell">
          <table className="w-full text-sm">
            <thead className="thead">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="trow">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{formatDateTime(r.createdAt)}</td>
                  <td className="px-3 py-2">
                    <Badge tone="neutral">{r.eventType.replace(/\./g, " · ")}</Badge>
                    <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{r.entityType} {r.entityId.slice(0, 8)}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">User {r.actorId.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{readableChange(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Page {currentPage} of {totalPages}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary px-3 py-1 text-xs" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Previous
            </button>
            <button type="button" className="btn-secondary px-3 py-1 text-xs" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Next
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
