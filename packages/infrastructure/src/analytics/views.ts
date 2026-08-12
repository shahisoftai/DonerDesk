export interface ProjectAnalytics {
  projectId: string;
  projectName: string;
  status: string;
  country: string;
  readinessScore: number;
  totalReportingPeriods: number;
  completedReports: number;
  pendingReports: number;
  totalEvidence: number;
  verifiedEvidence: number;
  pendingEvidence: number;
  lastActivityAt: Date;
  daysUntilNextDeadline: number | null;
}

export interface IndicatorProgress {
  projectId: string;
  indicatorId: string;
  indicatorName: string;
  baseline: number;
  target: number;
  currentValue: number;
  percentComplete: number;
  lastUpdated: Date;
  overdueUpdates: number;
}

export interface ComplianceSummary {
  projectId: string;
  periodId: string;
  periodName: string;
  dueDate: Date;
  readinessScore: number;
  checklistItemsTotal: number;
  checklistItemsResolved: number;
  completionPercent: number;
  daysUntilDue: number;
}

export interface EvidenceSummary {
  projectId: string;
  evidenceType: string;
  totalCount: number;
  verifiedCount: number;
  pendingCount: number;
  byMonth: Array<{
    month: string;
    count: number;
  }>;
}

export interface ActivitySummary {
  projectId: string;
  month: string;
  activitiesCreated: number;
  activitiesCompleted: number;
  fieldVisitsCount: number;
}

export const ANALYTICS_SQL = {
  project_summary: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_project_summary AS
    SELECT
      p."tenantId" as tenant_id,
      p.id as project_id,
      p.title as project_name,
      p.status,
      p.country,
      (SELECT COUNT(*) FROM "EvidenceFile" e WHERE e."projectId" = p.id AND e."tenantId" = p."tenantId" AND e."verificationStatus" = 'VERIFIED') as verified_evidence,
      (SELECT COUNT(*) FROM "EvidenceFile" e WHERE e."projectId" = p.id AND e."tenantId" = p."tenantId" AND e."verificationStatus" != 'VERIFIED') as pending_evidence,
      (SELECT COUNT(*) FROM "ReportingPeriod" rp WHERE rp."projectId" = p.id AND rp."tenantId" = p."tenantId") as total_reporting_periods,
      (SELECT COUNT(*) FROM "ReportingPeriod" rp WHERE rp."projectId" = p.id AND rp."tenantId" = p."tenantId" AND rp.status = 'COMPLETED') as completed_reports,
      (SELECT COUNT(*) FROM "ChecklistItem" ci WHERE ci."projectId" = p.id AND ci."tenantId" = p."tenantId" AND ci.status = 'RESOLVED') as checklist_items_resolved,
      (SELECT COUNT(*) FROM "ChecklistItem" ci WHERE ci."projectId" = p.id AND ci."tenantId" = p."tenantId") as checklist_items_total
    FROM "Project" p;
  `,

  indicator_progress: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_indicator_progress AS
    SELECT
      i."tenantId" as tenant_id,
      p.id as project_id,
      i.id as indicator_id,
      i.name as indicator_name,
      i.baseline,
      i.target,
      COALESCE(
        (SELECT iu."cumulativeAchievement" FROM "IndicatorUpdate" iu
         WHERE iu."indicatorId" = i.id AND iu."tenantId" = i."tenantId"
         ORDER BY iu."createdAt" DESC LIMIT 1),
        i.baseline
      ) as current_value,
      CASE WHEN COALESCE((SELECT MAX(iu."createdAt") FROM "IndicatorUpdate" iu WHERE iu."indicatorId" = i.id AND iu."tenantId" = i."tenantId"), i."createdAt") < CURRENT_DATE - INTERVAL '30 days' THEN 1 ELSE 0 END as overdue_updates,
      (SELECT MAX(iu."createdAt") FROM "IndicatorUpdate" iu WHERE iu."indicatorId" = i.id AND iu."tenantId" = i."tenantId") as last_updated
    FROM "Project" p
    JOIN "Indicator" i ON i."projectId" = p.id AND i."tenantId" = p."tenantId";
  `,

  compliance_monthly: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_compliance_monthly AS
    SELECT
      p."tenantId" as tenant_id,
      p.id as project_id,
      DATE_TRUNC('month', rp.deadline) as month,
      COUNT(DISTINCT rp.id) as reporting_periods_due,
      COUNT(DISTINCT CASE WHEN ci.status = 'RESOLVED' THEN ci.id END) as items_resolved,
      COUNT(DISTINCT ci.id) as items_total,
      ROUND(
        COUNT(DISTINCT CASE WHEN ci.status = 'RESOLVED' THEN ci.id END)::numeric /
        NULLIF(COUNT(DISTINCT ci.id), 0) * 100,
        2
      ) as compliance_rate
    FROM "Project" p
    JOIN "ReportingPeriod" rp ON rp."projectId" = p.id AND rp."tenantId" = p."tenantId"
    LEFT JOIN "ChecklistItem" ci ON ci."reportingPeriodId" = rp.id AND ci."tenantId" = p."tenantId"
    GROUP BY p."tenantId", p.id, DATE_TRUNC('month', rp.deadline);
  `,

  evidence_by_type: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_evidence_by_type AS
    SELECT
      e."tenantId" as tenant_id,
      e."projectId" as project_id,
      COALESCE(e."evidenceType", 'UNCLASSIFIED') as evidence_type,
      DATE_TRUNC('month', e."createdAt") as month,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE e."verificationStatus" = 'VERIFIED') as verified_count,
      COUNT(*) FILTER (WHERE e."verificationStatus" != 'VERIFIED') as pending_count
    FROM "EvidenceFile" e
    GROUP BY e."tenantId", e."projectId", COALESCE(e."evidenceType", 'UNCLASSIFIED'), DATE_TRUNC('month', e."createdAt");
  `,

  activity_summary: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_activity_summary AS
    SELECT
      p."tenantId" as tenant_id,
      p.id as project_id,
      DATE_TRUNC('month', au."createdAt") as month,
      COUNT(DISTINCT au.id) as activities_created,
      COUNT(DISTINCT CASE WHEN au.status = 'APPROVED' THEN au.id END) as activities_completed,
      0::bigint as field_visits
    FROM "Project" p
    JOIN "ActivityUpdate" au ON au."projectId" = p.id AND au."tenantId" = p."tenantId"
    GROUP BY p."tenantId", p.id, DATE_TRUNC('month', au."createdAt");
  `,

  risk_trend_summary: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_risk_trend_summary AS
    SELECT
      p.id as project_id,
      p."tenantId" as tenant_id,
      p.sector,
      p."donorName" as donor_name,
      COALESCE(prt."riskScore", 0) as current_risk_score,
      COALESCE(prt."riskLevel", 'LOW') as current_risk_level,
      COALESCE(prt."missingEvidenceCount", 0) as missing_evidence_count,
      COALESCE(prt."deadlineSlipsCount", 0) as deadline_slips_count,
      COALESCE(prt."overdueChecklistItemsCount", 0) as overdue_checklist_items,
      COALESCE(prt."lastUpdated", p."createdAt") as last_risk_update,
      (
        SELECT COUNT(*)
        FROM "EvidenceFile" e
        WHERE e."projectId" = p.id AND e."tenantId" = p."tenantId"
          AND e."createdAt" > NOW() - INTERVAL '30 days'
      ) as recent_evidence_count,
      (
        SELECT COUNT(*)
        FROM "ReportingPeriod" rp
        WHERE rp."projectId" = p.id AND rp."tenantId" = p."tenantId"
          AND rp.deadline < NOW()
          AND rp.status != 'COMPLETED'
      ) as overdue_reports
    FROM "Project" p
    LEFT JOIN LATERAL (
      SELECT trend.* FROM "ProjectRiskTrend" trend
      WHERE trend."projectId" = p.id AND trend."tenantId" = p."tenantId"
      ORDER BY trend."createdAt" DESC LIMIT 1
    ) prt ON true;
  `,

  lessons_learned_aggregation: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_lessons_learned_aggregation AS
    SELECT
      lp."tenantId" as tenant_id,
      lp.sector,
      lp."donorName" as donor_name,
      lp."patternType" as pattern_type,
      COUNT(*) as pattern_count,
      AVG(lp.confidence)::int as avg_confidence,
      SUM(jsonb_array_length(lp."projectsAffectedJson"::jsonb)) as projects_affected_count,
      ARRAY_AGG(DISTINCT lp.title ORDER BY lp.title) FILTER (WHERE lp."patternType" = 'recurring_challenge') as common_challenges,
      ARRAY_AGG(DISTINCT lp.title ORDER BY lp.title) FILTER (WHERE lp."patternType" = 'mitigation_success') as successful_mitigations
    FROM "LessonPattern" lp
    GROUP BY lp."tenantId", lp.sector, lp."donorName", lp."patternType";
  `,
};

export const METABASE_SQL_VIEWS = {
  project_overview: `
    CREATE OR REPLACE VIEW metabase_project_overview AS
    SELECT
      p.id,
      p.name,
      p.status,
      p.country,
      p.start_date,
      p.end_date,
      o.name as organization_name,
      (SELECT AVG(readiness_score) FROM reporting_periods WHERE project_id = p.id) as avg_readiness_score,
      (SELECT COUNT(*) FROM evidence WHERE project_id = p.id) as total_evidence,
      (SELECT COUNT(*) FROM evidence WHERE project_id = p.id AND status = 'VERIFIED') as verified_evidence
    FROM projects p
    JOIN organizations o ON o.tenant_id = p.tenant_id;
  `,

  report_timeline: `
    CREATE OR REPLACE VIEW metabase_report_timeline AS
    SELECT
      p.id as project_id,
      rp.id as period_id,
      rp.start_date,
      rp.end_date,
      rp.due_date,
      rp.status as period_status,
      rs.id as section_id,
      rs.title as section_title,
      rs.status as section_status,
      COALESCE(ci.resolved_count, 0) as checklist_items_resolved,
      COALESCE(ci.total_count, 0) as checklist_items_total
    FROM projects p
    JOIN reporting_periods rp ON rp.project_id = p.id
    JOIN report_sections rs ON rs.period_id = rp.id
    LEFT JOIN (
      SELECT period_id,
             COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_count,
             COUNT(*) as total_count
      FROM checklist_items
      GROUP BY period_id
    ) ci ON ci.period_id = rp.id;
  `,

  risk_dashboard: `
    CREATE OR REPLACE VIEW metabase_risk_dashboard AS
    SELECT
      p.id as project_id,
      p."tenantId" as tenant_id,
      p.title as project_name,
      p.sector,
      p."donorName" as donor_name,
      p.country,
      p.status as project_status,
      rts.current_risk_score,
      rts.current_risk_level,
      rts.missing_evidence_count,
      rts.deadline_slips_count,
      rts.overdue_checklist_items,
      rts.recent_evidence_count,
      rts.overdue_reports,
      CASE
        WHEN rts.current_risk_level = 'CRITICAL' THEN 'immediate_attention'
        WHEN rts.current_risk_level = 'HIGH' THEN 'priority_review'
        WHEN rts.current_risk_level = 'MEDIUM' THEN 'monitor'
        ELSE 'on_track'
      END as action_category
    FROM analytics_risk_trend_summary rts
    JOIN "Project" p ON p.id = rts.project_id AND p."tenantId" = rts.tenant_id;
  `,

  sector_intelligence: `
    CREATE OR REPLACE VIEW metabase_sector_intelligence AS
    SELECT
      p."tenantId" as tenant_id,
      p.sector,
      p."donorName" as donor_name,
      COUNT(DISTINCT p.id) as total_projects,
      AVG(rts.current_risk_score) as avg_risk_score,
      COUNT(DISTINCT CASE WHEN rts.current_risk_level IN ('HIGH', 'CRITICAL') THEN p.id END) as high_risk_projects,
      COUNT(DISTINCT CASE WHEN rts.missing_evidence_count > 5 THEN p.id END) as evidence_gap_projects,
      COUNT(DISTINCT CASE WHEN rts.overdue_reports > 0 THEN p.id END) as report_delinquency_projects,
      ARRAY_AGG(DISTINCT p."donorName") as donors,
      ARRAY_AGG(DISTINCT p.country) as countries
    FROM "Project" p
    LEFT JOIN analytics_risk_trend_summary rts ON rts.project_id = p.id AND rts.tenant_id = p."tenantId"
    GROUP BY p."tenantId", p.sector, p."donorName";
  `,
};
