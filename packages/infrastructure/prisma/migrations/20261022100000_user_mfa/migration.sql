-- Two-step sign-in with an authenticator app (TOTP). The shared secret is stored sealed, recovery codes as hashes,
-- and the last accepted time step so a code cannot be used twice.
ALTER TABLE "User" ADD COLUMN "mfaSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaPendingSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaRecoveryHashes" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "User" ADD COLUMN "mfaLastStep" INTEGER;
