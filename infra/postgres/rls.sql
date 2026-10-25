-- Run after Prisma has created the schema. Every tenant table is deny-by-default
-- when app.current_tenant is absent.
--
-- INVARIANT: every Prisma model that carries a tenantId is either listed in
-- the array below (tenant-isolated) or named in the global-tables block at the
-- end of this file (deliberately not tenant-isolated). A new tenant-scoped
-- model that is added to schema.prisma and not to this file fails
-- packages/infrastructure/test/rls-coverage.test.mjs.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Organization','User','Invitation','Project','ProjectMember','ProjectSetup','ReportingProfile',
    'DonorTemplate','DonorTemplateVersion','LogframeItem',
    'Indicator','IndicatorUpdate','ReportingPeriod','EvidenceFile','ActivityUpdate',
    'ReportDraft','ReportSection','ChecklistItem','ExportPackage','Comment',
    'ReportPlan','ReportClaim','ReportGenerationRun','DonorTemplateMapping',
    'ReportRevision','SubmissionSnapshot','ReportingRequirementPack','AwardReportingOverride','ResolvedReportingRequirements',
    'Notification','AuditEvent','LlmRun','LlmFeedback','EvidenceChunk','EvidenceEmbedding',
    'IdempotencyRecord','RequestIdempotency',
    'ReportArtifact','ReportArtifactRow','AgentMemory',
    'BillingSubscription','EntitlementGrant','UsageCounter','TrialIdentity','PurchasedCreditPack','NonprofitVerification',
    'PasswordResetToken','PeriodFinancialSummary',
    'PlannedActivity','PlanRevision','ProjectTask','ReminderLedgerEntry','ProjectRisk','PlannedActivityDependency','ProjectField','CustomFieldValue','BudgetLine','BudgetExpense','MemberCapacity','ProjectAutomation','Beneficiary','ProjectSubmissionMapping','PlannedActivityIndicator','ProgressEntry','BeneficiaryActivityLink',
    'ConnectorRun','SectorTemplatePack','ProjectRiskTrend','OrganizationBranding','LessonPattern','ABACFieldPolicy','MultiRegionBookmark',
    'ScimCredential','JobOutbox','LogframeVersion','Programme','Grant','DonorIndicatorMapping','ProjectAdaptation','TenantMapLayer','ProjectInfographic','InfographicExport','InfographicAsset','InfographicBrandKit','InfographicUserTemplate','InfographicShareLink'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO donordesk_app', table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.current_tenant'', true)) WITH CHECK ("tenantId" = current_setting(''app.current_tenant'', true))',
      table_name
    );
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO donordesk_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO donordesk_app;

-- The audit log is append-only. The runtime role may read it and add to it,
-- but never change or erase a row: a correction is a new event, not an edit.
-- The chain of hashes makes a change detectable after the fact; refusing the
-- privilege stops it happening at all. A DBA (the migrator role, which owns
-- the tables) can still repair, and a retention job runs as that role.
REVOKE UPDATE, DELETE ON TABLE "AuditEvent" FROM donordesk_app;
REVOKE UPDATE, DELETE ON TABLE "PlatformAuditEvent" FROM donordesk_app;

-- Global reference tables (no tenantId column, not tenant-isolated): the
-- runtime role needs DML to upsert model/prompt rows referenced by LlmRun.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "LlmModel" TO donordesk_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "LlmPrompt" TO donordesk_app;

-- PlanCatalogOverride is a global platform table (no tenantId column), read by
-- tenant-facing entitlement resolution and written by the SuperAdmin portal.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PlanCatalogOverride" TO donordesk_app;

-- BillingEventInbox is a global platform table even though it has a tenantId
-- column, because the column is NULLABLE and the tenant is resolved only
-- AFTER the provider event arrives: an event for an unknown customer stays
-- with tenantId NULL for manual review. A tenant_isolation policy would hide
-- those unresolved rows from every session, including the one that has to
-- recover them.
--
-- It is written by the inbound provider webhook (POST /v1/webhooks/creem) and
-- the internal reconciliation routes, both of which are service endpoints
-- outside the user-facing scope — no tenant-facing route reads it.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "BillingEventInbox" TO donordesk_app;
