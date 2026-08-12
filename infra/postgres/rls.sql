-- Run after Prisma has created the schema. Every tenant table is deny-by-default
-- when app.current_tenant is absent.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Organization','User','Invitation','Project','DonorTemplate','LogframeItem',
    'Indicator','IndicatorUpdate','ReportingPeriod','EvidenceFile','ActivityUpdate',
    'ReportDraft','ReportSection','ChecklistItem','ExportPackage','Comment',
    'Notification','AuditEvent','LlmRun','LlmFeedback','EvidenceChunk','EvidenceEmbedding'
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
