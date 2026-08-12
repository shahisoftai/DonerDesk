-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationType" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "sectors" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "website" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "logoUrl" TEXT,
    "mainOfficeLocation" TEXT,
    "donorTypesServed" TEXT,
    "dataResidency" TEXT NOT NULL DEFAULT 'DEFAULT',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "lastLoginAt" TIMESTAMP(3),
    "assignedProjectIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "projectIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "implementingOrganization" TEXT NOT NULL,
    "partnerOrganization" TEXT,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "district" TEXT,
    "sector" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "budgetAmount" DOUBLE PRECISION,
    "budgetCurrency" TEXT,
    "reportingFrequency" TEXT NOT NULL,
    "description" TEXT,
    "primaryContactName" TEXT,
    "projectManagerId" TEXT,
    "meOfficerId" TEXT,
    "reportingOfficerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "requiredAnnexes" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "originalFileUrl" TEXT,
    "extractedRawText" TEXT,
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogframeItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogframeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "logframeItemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseline" TEXT NOT NULL DEFAULT '',
    "target" TEXT NOT NULL DEFAULT '',
    "unit" TEXT,
    "meansOfVerification" TEXT,
    "dataSource" TEXT,
    "frequency" TEXT,
    "responsibleUserId" TEXT,
    "disaggregationRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorUpdate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "periodAchievement" TEXT NOT NULL,
    "cumulativeAchievement" TEXT NOT NULL,
    "comments" TEXT,
    "dataSource" TEXT,
    "attachedEvidenceIds" TEXT NOT NULL DEFAULT '[]',
    "verificationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "donorTemplateId" TEXT,
    "reportType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "internalReviewDeadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "responsibleOfficerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT,
    "fileName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "activityId" TEXT,
    "indicatorId" TEXT,
    "location" TEXT,
    "activityDate" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UPLOADED',
    "confidentialityLevel" TEXT NOT NULL DEFAULT 'INTERNAL',
    "notes" TEXT,
    "aiSummary" TEXT,
    "aiSuggestedTagsJson" TEXT NOT NULL DEFAULT '[]',
    "sensitivityWarning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityUpdate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "activityTitle" TEXT NOT NULL,
    "activityDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "outputId" TEXT,
    "indicatorId" TEXT,
    "participantsTotal" INTEGER,
    "participantsMale" INTEGER,
    "participantsFemale" INTEGER,
    "participantsChildren" INTEGER,
    "participantsDisability" INTEGER,
    "participantsOther" TEXT,
    "summary" TEXT NOT NULL,
    "achievements" TEXT NOT NULL DEFAULT '',
    "challenges" TEXT NOT NULL DEFAULT '',
    "lessonsLearned" TEXT NOT NULL DEFAULT '',
    "nextSteps" TEXT NOT NULL DEFAULT '',
    "attachedEvidenceIds" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT NOT NULL,
    "polishedNarrative" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedByAi" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportDraftId" TEXT NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "sectionOrder" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sourceReferencesJson" TEXT NOT NULL DEFAULT '[]',
    "unsupportedClaims" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportPackage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "exportedById" TEXT NOT NULL,
    "includedFiles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "mentionedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "systemNote" TEXT,
    "prevHash" TEXT NOT NULL DEFAULT '',
    "hash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL,
    "costPer1kTokens" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "jurisdiction" TEXT NOT NULL DEFAULT 'US',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmPrompt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "promptText" TEXT NOT NULL,
    "variables" TEXT NOT NULL,
    "modelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmRun" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "responseText" TEXT,
    "promptVersion" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmFeedback" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT,
    "taskType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "accepted" BOOLEAN NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "modelId" TEXT,
    "promptVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceChunk" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceEmbedding" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "vector" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectorTemplatePack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "indicatorTemplatesJson" TEXT NOT NULL DEFAULT '[]',
    "logframeTemplatesJson" TEXT NOT NULL DEFAULT '[]',
    "complianceTemplatesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectorTemplatePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRiskTrend" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "contributingFactorsJson" TEXT NOT NULL DEFAULT '[]',
    "missingEvidenceCount" INTEGER NOT NULL DEFAULT 0,
    "deadlineSlipsCount" INTEGER NOT NULL DEFAULT 0,
    "overdueChecklistItemsCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRiskTrend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationBranding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subdomain" TEXT,
    "brandingConfigJson" TEXT NOT NULL DEFAULT '{}',
    "dmarCStatus" TEXT NOT NULL DEFAULT 'none',
    "dkimStatus" TEXT NOT NULL DEFAULT 'pending',
    "spfStatus" TEXT NOT NULL DEFAULT 'pending',
    "customSSLCert" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonPattern" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "projectsAffectedJson" TEXT NOT NULL DEFAULT '[]',
    "mitigationStrategiesJson" TEXT NOT NULL DEFAULT '[]',
    "evidenceReferencesJson" TEXT NOT NULL DEFAULT '[]',
    "firstObserved" TIMESTAMP(3) NOT NULL,
    "lastObserved" TIMESTAMP(3) NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ABACFieldPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "fieldPoliciesJson" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ABACFieldPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiRegionBookmark" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "vectorClockJson" TEXT NOT NULL DEFAULT '[]',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'active',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MultiRegionBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_tenantId_key" ON "Organization"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_tenantId_idx" ON "Invitation"("tenantId");

-- CreateIndex
CREATE INDEX "DonorTemplate_tenantId_idx" ON "DonorTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "DonorTemplate_projectId_idx" ON "DonorTemplate"("projectId");

-- CreateIndex
CREATE INDEX "LogframeItem_tenantId_idx" ON "LogframeItem"("tenantId");

-- CreateIndex
CREATE INDEX "LogframeItem_projectId_idx" ON "LogframeItem"("projectId");

-- CreateIndex
CREATE INDEX "Indicator_tenantId_idx" ON "Indicator"("tenantId");

-- CreateIndex
CREATE INDEX "Indicator_projectId_idx" ON "Indicator"("projectId");

-- CreateIndex
CREATE INDEX "Indicator_logframeItemId_idx" ON "Indicator"("logframeItemId");

-- CreateIndex
CREATE INDEX "IndicatorUpdate_tenantId_idx" ON "IndicatorUpdate"("tenantId");

-- CreateIndex
CREATE INDEX "IndicatorUpdate_reportingPeriodId_idx" ON "IndicatorUpdate"("reportingPeriodId");

-- CreateIndex
CREATE INDEX "ReportingPeriod_tenantId_idx" ON "ReportingPeriod"("tenantId");

-- CreateIndex
CREATE INDEX "ReportingPeriod_projectId_idx" ON "ReportingPeriod"("projectId");

-- CreateIndex
CREATE INDEX "EvidenceFile_tenantId_idx" ON "EvidenceFile"("tenantId");

-- CreateIndex
CREATE INDEX "EvidenceFile_projectId_idx" ON "EvidenceFile"("projectId");

-- CreateIndex
CREATE INDEX "EvidenceFile_reportingPeriodId_idx" ON "EvidenceFile"("reportingPeriodId");

-- CreateIndex
CREATE INDEX "EvidenceFile_indicatorId_idx" ON "EvidenceFile"("indicatorId");

-- CreateIndex
CREATE INDEX "EvidenceFile_evidenceType_idx" ON "EvidenceFile"("evidenceType");

-- CreateIndex
CREATE INDEX "ActivityUpdate_tenantId_idx" ON "ActivityUpdate"("tenantId");

-- CreateIndex
CREATE INDEX "ActivityUpdate_projectId_idx" ON "ActivityUpdate"("projectId");

-- CreateIndex
CREATE INDEX "ActivityUpdate_reportingPeriodId_idx" ON "ActivityUpdate"("reportingPeriodId");

-- CreateIndex
CREATE INDEX "ReportDraft_tenantId_idx" ON "ReportDraft"("tenantId");

-- CreateIndex
CREATE INDEX "ReportDraft_reportingPeriodId_idx" ON "ReportDraft"("reportingPeriodId");

-- CreateIndex
CREATE INDEX "ReportSection_tenantId_idx" ON "ReportSection"("tenantId");

-- CreateIndex
CREATE INDEX "ReportSection_reportDraftId_idx" ON "ReportSection"("reportDraftId");

-- CreateIndex
CREATE INDEX "ChecklistItem_tenantId_idx" ON "ChecklistItem"("tenantId");

-- CreateIndex
CREATE INDEX "ChecklistItem_reportingPeriodId_idx" ON "ChecklistItem"("reportingPeriodId");

-- CreateIndex
CREATE INDEX "ExportPackage_tenantId_idx" ON "ExportPackage"("tenantId");

-- CreateIndex
CREATE INDEX "Comment_tenantId_idx" ON "Comment"("tenantId");

-- CreateIndex
CREATE INDEX "Comment_entityType_entityId_idx" ON "Comment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_idx" ON "AuditEvent"("tenantId");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_idx" ON "AuditEvent"("projectId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmModel_provider_idx" ON "LlmModel"("provider");

-- CreateIndex
CREATE INDEX "LlmModel_jurisdiction_idx" ON "LlmModel"("jurisdiction");

-- CreateIndex
CREATE INDEX "LlmPrompt_name_idx" ON "LlmPrompt"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LlmPrompt_name_version_key" ON "LlmPrompt"("name", "version");

-- CreateIndex
CREATE INDEX "LlmRun_tenantId_idx" ON "LlmRun"("tenantId");

-- CreateIndex
CREATE INDEX "LlmRun_modelId_idx" ON "LlmRun"("modelId");

-- CreateIndex
CREATE INDEX "LlmRun_promptId_idx" ON "LlmRun"("promptId");

-- CreateIndex
CREATE INDEX "LlmRun_createdAt_idx" ON "LlmRun"("createdAt");

-- CreateIndex
CREATE INDEX "LlmFeedback_tenantId_idx" ON "LlmFeedback"("tenantId");

-- CreateIndex
CREATE INDEX "LlmFeedback_taskType_idx" ON "LlmFeedback"("taskType");

-- CreateIndex
CREATE INDEX "LlmFeedback_entityType_entityId_idx" ON "LlmFeedback"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "LlmFeedback_accepted_idx" ON "LlmFeedback"("accepted");

-- CreateIndex
CREATE INDEX "EvidenceChunk_evidenceId_idx" ON "EvidenceChunk"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceChunk_tenantId_idx" ON "EvidenceChunk"("tenantId");

-- CreateIndex
CREATE INDEX "EvidenceEmbedding_chunkId_idx" ON "EvidenceEmbedding"("chunkId");

-- CreateIndex
CREATE INDEX "EvidenceEmbedding_tenantId_idx" ON "EvidenceEmbedding"("tenantId");

-- CreateIndex
CREATE INDEX "SectorTemplatePack_tenantId_idx" ON "SectorTemplatePack"("tenantId");

-- CreateIndex
CREATE INDEX "SectorTemplatePack_organizationId_idx" ON "SectorTemplatePack"("organizationId");

-- CreateIndex
CREATE INDEX "SectorTemplatePack_sector_idx" ON "SectorTemplatePack"("sector");

-- CreateIndex
CREATE INDEX "SectorTemplatePack_status_idx" ON "SectorTemplatePack"("status");

-- CreateIndex
CREATE INDEX "ProjectRiskTrend_tenantId_idx" ON "ProjectRiskTrend"("tenantId");

-- CreateIndex
CREATE INDEX "ProjectRiskTrend_projectId_idx" ON "ProjectRiskTrend"("projectId");

-- CreateIndex
CREATE INDEX "ProjectRiskTrend_riskLevel_idx" ON "ProjectRiskTrend"("riskLevel");

-- CreateIndex
CREATE INDEX "ProjectRiskTrend_tenantId_riskLevel_idx" ON "ProjectRiskTrend"("tenantId", "riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationBranding_organizationId_key" ON "OrganizationBranding"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationBranding_tenantId_idx" ON "OrganizationBranding"("tenantId");

-- CreateIndex
CREATE INDEX "LessonPattern_tenantId_idx" ON "LessonPattern"("tenantId");

-- CreateIndex
CREATE INDEX "LessonPattern_sector_idx" ON "LessonPattern"("sector");

-- CreateIndex
CREATE INDEX "LessonPattern_donorName_idx" ON "LessonPattern"("donorName");

-- CreateIndex
CREATE INDEX "LessonPattern_patternType_idx" ON "LessonPattern"("patternType");

-- CreateIndex
CREATE INDEX "LessonPattern_tenantId_sector_donorName_idx" ON "LessonPattern"("tenantId", "sector", "donorName");

-- CreateIndex
CREATE INDEX "ABACFieldPolicy_tenantId_idx" ON "ABACFieldPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "ABACFieldPolicy_resourceType_idx" ON "ABACFieldPolicy"("resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "ABACFieldPolicy_tenantId_organizationId_role_resourceType_key" ON "ABACFieldPolicy"("tenantId", "organizationId", "role", "resourceType");

-- CreateIndex
CREATE INDEX "MultiRegionBookmark_tenantId_idx" ON "MultiRegionBookmark"("tenantId");

-- CreateIndex
CREATE INDEX "MultiRegionBookmark_entityType_entityId_idx" ON "MultiRegionBookmark"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "MultiRegionBookmark_tenantId_region_entityType_entityId_key" ON "MultiRegionBookmark"("tenantId", "region", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorTemplate" ADD CONSTRAINT "DonorTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogframeItem" ADD CONSTRAINT "LogframeItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_logframeItemId_fkey" FOREIGN KEY ("logframeItemId") REFERENCES "LogframeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorUpdate" ADD CONSTRAINT "IndicatorUpdate_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingPeriod" ADD CONSTRAINT "ReportingPeriod_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUpdate" ADD CONSTRAINT "ActivityUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUpdate" ADD CONSTRAINT "ActivityUpdate_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDraft" ADD CONSTRAINT "ReportDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDraft" ADD CONSTRAINT "ReportDraft_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSection" ADD CONSTRAINT "ReportSection_reportDraftId_fkey" FOREIGN KEY ("reportDraftId") REFERENCES "ReportDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportPackage" ADD CONSTRAINT "ExportPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportPackage" ADD CONSTRAINT "ExportPackage_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmPrompt" ADD CONSTRAINT "LlmPrompt_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "LlmModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmRun" ADD CONSTRAINT "LlmRun_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "LlmModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmRun" ADD CONSTRAINT "LlmRun_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "LlmPrompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmFeedback" ADD CONSTRAINT "LlmFeedback_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "LlmPrompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceEmbedding" ADD CONSTRAINT "EvidenceEmbedding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "EvidenceChunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

