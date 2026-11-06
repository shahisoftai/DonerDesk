-- SCIM provisioning credentials (Enterprise). One row per identity provider
-- credential; only the hash of the token is kept, so a leaked database cannot
-- be used to provision users.
--
-- Additive: a new table, an index and a unique constraint.

CREATE TABLE IF NOT EXISTS "ScimCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScimCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScimCredential_tokenHash_key" ON "ScimCredential"("tokenHash");
CREATE INDEX IF NOT EXISTS "ScimCredential_tenantId_idx" ON "ScimCredential"("tenantId");
