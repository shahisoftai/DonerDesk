-- Closes the drift between the checked-in migrations and schema.prisma.
--
-- Until now the schema and the migration history had diverged: a relation
-- declared in the schema had no foreign key in the database, and two indexes
-- carried names from an older Prisma naming rule. The database was built
-- with `prisma db push`, so the migration files were never executed and the
-- divergence was invisible.
--
-- Additive only: a foreign key and two index renames. No column is added,
-- dropped or retyped here.

-- ReportRevision belongs to a section. The relation was declared in
-- schema.prisma but the constraint was never created, so a revision could
-- point at a section that does not exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReportRevision_sectionId_fkey'
  ) THEN
    ALTER TABLE "ReportRevision"
      ADD CONSTRAINT "ReportRevision_sectionId_fkey"
      FOREIGN KEY ("sectionId") REFERENCES "ReportSection"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Prisma truncates index names to 63 characters; these two were created under
-- the older rule. Renaming them makes the database match the schema exactly,
-- so the drift check is quiet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ReminderLedgerEntry_tenantId_recipientId_subjectKey_ruleKey_sen'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ReminderLedgerEntry_tenantId_recipientId_subjectKey_ruleKey_key'
  ) THEN
    ALTER INDEX "ReminderLedgerEntry_tenantId_recipientId_subjectKey_ruleKey_sen"
      RENAME TO "ReminderLedgerEntry_tenantId_recipientId_subjectKey_ruleKey_key";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ReportingRequirementPack_tenantId_donorKey_mechanismKey_reportT'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ReportingRequirementPack_tenantId_donorKey_mechanismKey_rep_key'
  ) THEN
    ALTER INDEX "ReportingRequirementPack_tenantId_donorKey_mechanismKey_reportT"
      RENAME TO "ReportingRequirementPack_tenantId_donorKey_mechanismKey_rep_key";
  END IF;
END $$;
