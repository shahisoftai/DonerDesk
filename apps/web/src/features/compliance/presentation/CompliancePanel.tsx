"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { can, type Capability } from "@/lib/shared/capabilities";
import { Badge } from "@/components/data/Badge";
import { Select } from "@/components/ui/Select";
import { ReadinessGauge } from "@/components/data/ReadinessGauge";
import { severityTone, checklistStatusTone } from "@/lib/shared/tone";
import {
  CHECKLIST_ITEM_TYPE_LABEL,
  CHECKLIST_STATUS_LABEL,
  SEVERITY_LABEL,
} from "@/lib/labels";
import { formatDate } from "@/lib/shared/dates";
import { complianceFixLink } from "@/lib/shared/compliance-links";
import { ChecklistResolution } from "./ChecklistResolution";
import { BulkChecklistResolution } from "./BulkChecklistResolution";

type Period = { id: string; label: string };
type ChecklistItem = {
  id: string;
  type: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  dueDate?: string | null;
  assignedToId?: string | null;
  resolutionNotes?: string | null;
};
type Readiness = {
  overall: number;
  sectionsScore: number;
  indicatorsScore: number;
  evidenceScore: number;
  checklistScore: number;
  approvalScore: number;
};

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUS_FILTERS = ["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"];

export function CompliancePanel({
  projectId,
  periods,
  periodId,
  checklist,
  readiness,
  capabilities,
}: {
  projectId: string;
  periods: Period[];
  periodId: string;
  checklist: ChecklistItem[];
  readiness: Readiness;
  capabilities: readonly Capability[];
}) {
  const router = useRouter();
  const canResolve = can(capabilities, "checklist.resolve") || can(capabilities, "checklist.manage");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const openItems = checklist.filter(
    (c) => c.status !== "RESOLVED" && c.status !== "ACCEPTED_RISK" && c.status !== "NOT_APPLICABLE",
  );

  const filtered = useMemo(
    () =>
      checklist.filter(
        (c) =>
          (!statusFilter || c.status === statusFilter) &&
          (!severityFilter || c.severity === severityFilter),
      ),
    [checklist, statusFilter, severityFilter],
  );

  const openBySeverity = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    items: filtered.filter((c) => c.severity === sev && c.status !== "RESOLVED" && c.status !== "ACCEPTED_RISK" && c.status !== "NOT_APPLICABLE"),
  })).filter((g) => g.items.length > 0);

  const resolved = filtered.filter((c) => c.status === "RESOLVED" || c.status === "ACCEPTED_RISK" || c.status === "NOT_APPLICABLE");

  function changePeriod(id: string) {
    setSelectedIds(new Set());
    setBulkMode(false);
    router.push(`/projects/${projectId}/compliance?period=${id}`);
  }

  function toggleBulkMode() {
    setBulkMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="period-select">Reporting period</label>
          <Select id="period-select" value={periodId} onChange={(e) => changePeriod(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="status-filter">Status</label>
          <Select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{CHECKLIST_STATUS_LABEL[s] ?? s.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="severity-filter">Severity</label>
          <Select id="severity-filter" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="">All</option>
            {SEVERITY_ORDER.map((s) => (
              <option key={s} value={s}>{SEVERITY_LABEL[s] ?? s}</option>
            ))}
          </Select>
        </div>
        {canResolve && openItems.length > 1 && (
          <div className="flex items-end">
            <button
              type="button"
              className={bulkMode ? "btn" : "btn-secondary"}
              onClick={toggleBulkMode}
            >
              {bulkMode ? "Exit bulk" : "Bulk actions"}
            </button>
          </div>
        )}
      </div>

      {bulkMode && selectedIds.size > 0 && canResolve && (
        <div className="mt-4">
          <BulkChecklistResolution
            periodId={periodId}
            itemIds={Array.from(selectedIds)}
            onDone={() => setSelectedIds(new Set())}
          />
        </div>
      )}

      {bulkMode && selectedIds.size === 0 && (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Select items below to apply an action to all of them at once.
        </p>
      )}

      {filtered.length === 0 && (
        <div className="card text-sm text-slate-600 dark:text-slate-300">No checklist items match.</div>
      )}

      {openBySeverity.map((group) => (
        <section key={group.severity} aria-label={`${group.severity} severity items`}>
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {SEVERITY_LABEL[group.severity] ?? group.severity}
            <span className="ml-2 font-normal text-slate-400">({group.items.length})</span>
          </h2>
          <div className="mt-2 space-y-3">
            {group.items.map((item) => (
              <ChecklistCard
                key={item.id}
                projectId={projectId}
                periodId={periodId}
                item={item}
                canResolve={canResolve}
                bulkMode={bulkMode}
                selected={selectedIds.has(item.id)}
                onToggle={toggleSelected}
              />
            ))}
          </div>
        </section>
      ))}

      {resolved.length > 0 && (
        <section aria-label="Resolved items">
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">Resolved</h2>
          <div className="mt-2 space-y-3">
            {resolved.map((item) => (
              <ChecklistCard
                key={item.id}
                projectId={projectId}
                periodId={periodId}
                item={item}
                canResolve={false}
                resolved
              />
            ))}
          </div>
        </section>
      )}

      <ReadinessPanel projectId={projectId} periodId={periodId} readiness={readiness} />
    </div>
  );
}

function ChecklistCard({
  projectId,
  periodId,
  item,
  canResolve,
  resolved = false,
  bulkMode = false,
  selected = false,
  onToggle,
}: {
  projectId: string;
  periodId: string;
  item: ChecklistItem;
  canResolve: boolean;
  resolved?: boolean;
  bulkMode?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
}) {
  const fix = complianceFixLink({
    projectId,
    periodId,
    type: item.type,
    relatedEntityType: item.relatedEntityType,
    relatedEntityId: item.relatedEntityId,
  });

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {bulkMode && !resolved && canResolve && (
          <div className="pt-1">
            <input
              type="checkbox"
              aria-label={`Select ${item.title}`}
              checked={selected}
              onChange={() => onToggle?.(item.id)}
              className="h-4 w-4 accent-brand-600"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-100">{item.title}</span>
            <Badge tone={severityTone(item.severity)}>{SEVERITY_LABEL[item.severity] ?? item.severity}</Badge>
            <Badge tone={checklistStatusTone(item.status)}>{CHECKLIST_STATUS_LABEL[item.status] ?? item.status.replace(/_/g, " ")}</Badge>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {CHECKLIST_ITEM_TYPE_LABEL[item.type] ?? item.type.replace(/_/g, " ")}
            {item.dueDate ? ` · Due ${formatDate(item.dueDate)}` : ""}
          </div>
          {item.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
          )}
          {item.resolutionNotes && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Note: {item.resolutionNotes}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {fix && (
          <Link className="btn-secondary py-1 text-xs" href={fix.href}>{fix.label}</Link>
        )}
        {canResolve && !resolved && <ChecklistResolution itemId={item.id} severity={item.severity} />}
      </div>
    </div>
  );
}

function ReadinessPanel({
  projectId,
  periodId,
  readiness,
}: {
  projectId: string;
  periodId: string;
  readiness: Readiness;
}) {
  return (
    <section className="card" aria-label="Readiness explanation">
      <h2 className="text-sm font-medium text-slate-700 dark:text-slate-200">Report readiness</h2>
      <div className="mt-2">
        <ReadinessGauge value={readiness.overall} />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Overall readiness is the weighted backend score for this reporting period. It reflects the components below.
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <ReadinessLink label="Sections" v={readiness.sectionsScore} href={`/projects/${projectId}/reports/${periodId}`} />
        <ReadinessLink label="Indicators" v={readiness.indicatorsScore} href={`/projects/${projectId}/logframe`} />
        <ReadinessLink label="Evidence" v={readiness.evidenceScore} href={`/projects/${projectId}/evidence`} />
        <ReadinessLink label="Checklist" v={readiness.checklistScore} href={`/projects/${projectId}/compliance?period=${periodId}`} />
        <ReadinessLink label="Approval" v={readiness.approvalScore} href={`/projects/${projectId}/reports/${periodId}`} />
      </dl>
    </section>
  );
}

function ReadinessLink({ label, v, href }: { label: string; v: number; href: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={href} className="text-slate-500 hover:text-brand-600 hover:underline dark:text-slate-400 dark:hover:text-brand-400">
        {label}
      </Link>
      <span className="font-mono text-xs">{v}%</span>
    </div>
  );
}
