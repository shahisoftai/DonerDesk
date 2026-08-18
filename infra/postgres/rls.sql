-- Run after Prisma has created the schema. Every tenant table is deny-by-default
-- when app.current_tenant is absent.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Organization','User','Invitation','Project','ProjectMember','ProjectSetup','ReportingProfile',
    'DonorTemplate','LogframeItem',
    'Indicator','IndicatorUpdate','ReportingPeriod','EvidenceFile','ActivityUpdate',
    'ReportDraft','ReportSection','ChecklistItem','ExportPackage','Comment',
    'ReportPlan','ReportClaim','ReportGenerationRun','DonorTemplateMapping',
    'Notification','AuditEvent','LlmRun','LlmFeedback','EvidenceChunk','EvidenceEmbedding',
    'IdempotencyRecord',
    'BillingSubscription','EntitlementGrant','UsageCounter','TrialIdentity'
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

-- Global reference tables (no tenantId column, not tenant-isolated): the
-- runtime role needs DML to upsert model/prompt rows referenced by LlmRun.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "LlmModel" TO donordesk_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "LlmPrompt" TO donordesk_app;

-- PlanCatalogOverride is a global platform table (no tenantId column), read by
-- tenant-facing entitlement resolution and written by the SuperAdmin portal.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PlanCatalogOverride" TO donordesk_app;
