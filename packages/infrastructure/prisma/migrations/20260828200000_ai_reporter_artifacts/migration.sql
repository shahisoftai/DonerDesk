-- AI Reporter 2 — typed artifact storage (additive).
-- One row per typed artifact (table, chart, list, key/value, Q&A, delta) plus
-- per-row cells for table/list artifacts. Always tenant-scoped; RLS is added
-- in a separate migration in infra/postgres/rls.sql so the migrator can apply
-- both in the same transaction.

CREATE TABLE "ReportArtifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "revisionId" TEXT,
    "kind" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "sourceRefsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportArtifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportArtifact_tenantId_idx" ON "ReportArtifact"("tenantId");
CREATE INDEX "ReportArtifact_sectionId_idx" ON "ReportArtifact"("sectionId");
CREATE INDEX "ReportArtifact_revisionId_idx" ON "ReportArtifact"("revisionId");

ALTER TABLE "ReportArtifact"
    ADD CONSTRAINT "ReportArtifact_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "ReportSection"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReportArtifactRow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "cellsJson" TEXT NOT NULL DEFAULT '[]',
    "sourceRefsJson" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "ReportArtifactRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportArtifactRow_tenantId_idx" ON "ReportArtifactRow"("tenantId");
CREATE INDEX "ReportArtifactRow_artifactId_idx" ON "ReportArtifactRow"("artifactId");

ALTER TABLE "ReportArtifactRow"
    ADD CONSTRAINT "ReportArtifactRow_artifactId_fkey"
    FOREIGN KEY ("artifactId") REFERENCES "ReportArtifact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
