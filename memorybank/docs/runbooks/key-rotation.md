# Key Rotation Runbook

## Overview

This runbook covers the procedures for rotating cryptographic keys used in DonorDesk.
Rotation is performed quarterly, or immediately after a potential compromise.

## Key Types

| Key | Purpose | Rotation Frequency | Storage |
|-----|---------|-------------------|---------|
| Master Encryption Key (MEK) | Encrypts DEKs at rest | Quarterly | AWS KMS / HashiCorp Vault |
| Data Encryption Keys (DEK) | Encrypts PII column data | Per-tenant, quarterly | PostgreSQL (encrypted) |
| JWT Signing Key | Signs access tokens | Quarterly | Environment variable / Vault |
| HMAC Key | Webhook signatures | Semi-annually | Environment variable / Vault |
| Database Encryption Key | Transparent disk encryption | Annually | AWS RDS / PostgreSQL |

## Pre-Rotation Checklist

- [ ] Notify engineering team of planned rotation window
- [ ] Notify customers if JWT rotation will cause brief logout
- [ ] Verify backup of current keys exists
- [ ] Ensure rollback plan is documented
- [ ] Schedule 2-hour maintenance window for MEK rotation

## Quarterly MEK Rotation Procedure

### Step 1: Generate New Key

```bash
# Using AWS KMS
aws kms create-key --description "DonorDesk MEK - Q3 2026" --key-usage ENCRYPT_DECRYPT

# Store the new key ARN in Vault
vault kv put secret/donordesk/mek alias="current" arn="arn:aws:kms:eu-west-1:123456789:key/xxx" version=3
```

### Step 2: Update Application Configuration

```bash
# Add new key to rotation config (zero-downtime)
export KMS_KEY_ARN_NEW="arn:aws:kms:eu-west-1:123456789:key/yyy"

# Update Vault with new key
vault kv put secret/donordesk/mek alias="current" arn="$KMS_KEY_ARN_NEW" version=4
```

### Step 3: Re-encrypt DEKs with New MEK

```bash
# Run the re-encryption script (requires downtime window)
psql $DATABASE_URL -f scripts/reencrypt-deks.sql
```

### Step 4: Verify Rotation

```bash
# Verify audit log entries
psql $DATABASE_URL -c "SELECT id, tenant_id, created_at FROM audit_events ORDER BY created_at DESC LIMIT 10;"

# Verify PII decryption still works
psql $DATABASE_URL -c "SELECT COUNT(*) FROM organizations WHERE contact_email_encrypted IS NOT NULL;"
```

### Step 5: Revoke Old Key (After 30-day grace period)

```bash
aws kms schedule-key-deletion --key-id arn:aws:kms:eu-west-1:123456789:key/xxx --pending-window-in-days 30
```

## Breaking Glass Procedure (Emergency Rotation)

If a key compromise is suspected:

1. **IMMEDIATE**: Rotate the potentially compromised key
2. **Within 1 hour**: Force re-encryption of affected tenant data
3. **Within 24 hours**: Notify affected tenants
4. **Within 48 hours**: File incident report

```bash
# Emergency MEK rotation (no grace period)
aws kms schedule-key-deletion --key-id $COMPROMISED_KEY_ARN --pending-window-in-days 7

# Force re-encryption for all tenants
FORCE_REENCRYPT=true node scripts/reencrypt-all.js
```

## Verification Commands

```bash
# Verify JWT signing key is current
curl -s https://api.donordesk.com/health | jq '.auth_key_version'

# Verify audit hash chain integrity
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.donordesk.com/internal/audit/verify-chain | jq '.valid'

# Verify PII vault is operational
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.donordesk.com/internal/pii/health | jq '.vault_ok'
```

## Rollback Procedure

If rotation fails:

1. Revert `KMS_KEY_ARN` environment variable to previous value
2. Restore key from backup: `vault kv get secret/donordesk/mek` previous version
3. Restart API pods: `kubectl rollout restart deployment/donordesk-api`
4. Verify operational: `curl https://api.donordesk.com/health`

## Post-Rotation Documentation

After each rotation, update:

- [ ] This runbook with any deviations
- [ ] Vault audit log
- [ ] Security incident tracker
- [ ] Customer-facing changelog if JWT keys rotated
