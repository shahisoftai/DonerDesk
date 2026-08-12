# DonorDesk Disaster Recovery Runbook

## Document Info
- **Version**: 1.0
- **Last Updated**: 2026-08-12
- **Owner**: Platform Engineering
- **Classification**: INTERNAL - CONFIDENTIAL

---

## 1. Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | 5 minutes | Aurora Global DB replication lag |
| **RTO** (Recovery Time Objective) | 30 minutes | Time to fail over and serve traffic |
| **RLO** (Recovery Level Objective) | Last 5 minutes of transactions | Evidence files in S3 CRR |

---

## 2. Data Residency Regions

| Region Label | Primary Region | Secondary Region | Backup Region |
|--------------|----------------|------------------|---------------|
| EU | eu-west-1 | eu-central-1 | us-east-1 |
| US | us-east-1 | us-west-2 | eu-west-1 |
| AFRICA | af-south-1 | af-north-1 | eu-west-1 |
| ASIA | ap-southeast-1 | ap-south-1 | us-east-1 |

---

## 3. Failover Procedures

### 3.1 Aurora Global Database Failover

```bash
#!/bin/bash
# aurora-global-failover.sh
# Run from control plane or jump host with AWS CLI configured

set -euo pipefail

NEW_PRIMARY_REGION="${1:?target region is required}"
ENVIRONMENT="${2:?environment is required}"

echo "=== Initiating Aurora Global Failover to ${NEW_PRIMARY_REGION} ==="

# 1. Verify current primary
CURRENT_PRIMARY=$(aws rds describe-global-clusters \
  --global-cluster-identifier "donordesk-${ENVIRONMENT}-global" \
  --query 'GlobalClusters[0].GlobalClusterMembers[?IsWriter==true].AvailabilityZone' \
  --output text)

echo "Current primary: ${CURRENT_PRIMARY}"

# 2. Perform managed planned failover
aws rds failover-global-cluster \
  --global-cluster-identifier "donordesk-${ENVIRONMENT}-global" \
  --target-region "${NEW_PRIMARY_REGION}" \
  --cli-connect-timeout 300

# 3. Wait for replication to complete
echo "Waiting for failover completion..."
aws rds wait global-cluster-available \
  --global-cluster-identifier "donordesk-${ENVIRONMENT}-global" \
  --region "${NEW_PRIMARY_REGION}"

# 4. Verify new primary
NEW_WRITER=$(aws rds describe-global-clusters \
  --global-cluster-identifier "donordesk-${ENVIRONMENT}-global" \
  --region "${NEW_PRIMARY_REGION}" \
  --query 'GlobalClusters[0].GlobalClusterMembers[?IsWriter==true].AvailabilityZone' \
  --output text)

echo "=== Failover complete. New primary: ${NEW_WRITER} ==="
```

### 3.2 DNS Failover (Route 53)

```bash
#!/bin/bash
# dns-failover.sh
# Updates Route 53 health checks and routing policy

set -euo pipefail

TARGET_REGION="${1:?target region is required}"
ENVIRONMENT="${2:?environment is required}"
TARGET_API_ENDPOINT="${3:?healthy regional API endpoint is required}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:?Route 53 hosted-zone ID is required}"

# Never point the public API DNS record at an RDS endpoint. This value must be
# the validated regional API load-balancer hostname.
NEW_ENDPOINT="${TARGET_API_ENDPOINT}"

# Update Route 53 record sets
aws route53 change-resource-record-sets \
  --hosted-zone-id "${HOSTED_ZONE_ID}" \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"api.donordesk.com\",
        \"Type\": \"CNAME\",
        \"TTL\": 60,
        \"ResourceRecords\": [{\"Value\": \"${NEW_ENDPOINT}\"}]
      }
    }]
  }"

echo "=== DNS failover complete. API now pointing to ${NEW_ENDPOINT} ==="
```

### 3.3 S3 Evidence Bucket Failover

```bash
#!/bin/bash
# s3-failover.sh
# When primary region fails, promote secondary bucket to primary

set -euo pipefail

SOURCE_REGION="${1:?source region is required}"
TARGET_REGION="${2:?target region is required}"
ENVIRONMENT="${3:?environment is required}"

ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

# Source bucket name
SOURCE_BUCKET="donordesk-${ENVIRONMENT}-evidence-primary-${ACCOUNT_ID}"
# Target bucket (new primary)
TARGET_BUCKET="donordesk-${ENVIRONMENT}-evidence-${TARGET_REGION}-${ACCOUNT_ID}"

echo "=== Syncing evidence from ${SOURCE_BUCKET} to ${TARGET_BUCKET} ==="

# Fail closed if the source cannot be inspected. An empty/unreachable source
# must never be allowed to erase a healthy replica.
aws s3api head-bucket --bucket "${SOURCE_BUCKET}" --region "${SOURCE_REGION}"
aws s3api head-bucket --bucket "${TARGET_BUCKET}" --region "${TARGET_REGION}"

# Start cross-region copy (S3 batch operations for large datasets)
aws s3 sync "s3://${SOURCE_BUCKET}/" "s3://${TARGET_BUCKET}/" \
  --source-region "${SOURCE_REGION}" \
  --region "${TARGET_REGION}" \
  --storage-class STANDARD_IA

# Verify sync completion
SOURCE_COUNT=$(aws s3api list-objects-v2 \
  --bucket "${SOURCE_BUCKET}" \
  --region "${SOURCE_REGION}" \
  --query 'length(Contents)' \
  --output text)

TARGET_COUNT=$(aws s3api list-objects-v2 \
  --bucket "${TARGET_BUCKET}" \
  --region "${TARGET_REGION}" \
  --query 'length(Contents)' \
  --output text)

echo "Source objects: ${SOURCE_COUNT}, Target objects: ${TARGET_COUNT}"

if [[ "${SOURCE_COUNT}" == "${TARGET_COUNT}" ]]; then
  echo "=== S3 sync verified. Evidence bucket failover complete. ==="
else
  echo "WARNING: Object count mismatch. Manual verification required."
  exit 1
fi
```

---

## 4. Regional Failover Runbook

### Phase 1: Detection (0-5 minutes)
1. **Alert fires**: PagerDuty alert for Aurora cluster unavailable OR API health check failure
2. **On-call engineer acknowledges** within 5 minutes
3. **Verify the issue**:
   ```bash
   # Check Aurora global cluster status
   aws rds describe-global-clusters \
     --global-cluster-identifier "donordesk-prod-global"

   # Check API pod status
   kubectl get pods -n donordesk -l app=donordesk-api

   # Check CloudWatch metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/RDS \
     --metric-name DatabaseConnections \
     --dimensions Name=DBClusterIdentifier,Value="donordesk-prod-global" \
     --start-time 2026-08-12T00:00:00Z \
     --end-time 2026-08-12T12:00:00Z \
     --period 300 \
     --statistics Average
   ```

### Phase 2: Decision (5-10 minutes)
1. **Determine failure scope**:
   - Is it the primary database region?
   - Is it a single AZ failure (handled automatically by Aurora)?
   - Is it a network/connectivity issue?
   - Is it a data residency violation?

2. **Check data residency constraints**:
   - If tenant's `dataResidency` is set, failover must stay within allowed region pair
   - Reference: `infra/terraform/multi-region.tf` variable `data_residency_regions`

3. **Decision matrix**:
   | Scenario | Action |
   |----------|--------|
   | Single AZ failure | No action needed (Aurora handles automatically) |
   | Primary region failure | Initiate Aurora global failover |
   | Prolonged regional outage (>30 min) | Activate DR region, update DNS |
   | Data residency violation detected | Failover to compliant region immediately |

### Phase 3: Failover Execution (10-25 minutes)

#### For Aurora Global Database:
```bash
# 1. Execute Aurora failover
./scripts/aurora-global-failover.sh eu-west-1 prod

# 2. Verify new primary is accepting connections
aws rds execute-statement \
  --resource-arn "arn:aws:rds:eu-west-1:${ACCOUNT_ID}:cluster:donordesk-prod-global-eu-west-1" \
  --database donordesk \
  --sql "SELECT 1"

# 3. Update application environment variables
kubectl set env deployment/donordesk-api DATABASE_URL="postgresql://..." -n donordesk

# 4. Restart API pods to pick up new connection
kubectl rollout restart deployment/donordesk-api -n donordesk
```

#### For S3 Evidence:
```bash
# Sync evidence files if primary region is down
./scripts/s3-failover.sh us-east-1 eu-west-1 prod

# Verify evidence integrity
./scripts/verify-evidence-integrity.sh prod
```

#### For API Servers:
```bash
# If API pods are in failed region, cordon the node
kubectl cordon node -l topology.kubernetes.io/region=us-east-1

# Drain pods from failed region
kubectl drain node -l topology.kubernetes.io/region=us-east-1 --ignore-daemonsets --delete-emptydir-data

# Scale up in healthy regions
kubectl scale deployment donordesk-api --replicas=6 -n donordesk
```

### Phase 4: Post-Failover (25-30 minutes)
1. **Verify API health**:
   ```bash
   curl https://api.donordesk.com/health
   # Expected: {"status":"ok","region":"eu-west-1","version":"1.x.x"}
   ```

2. **Notify stakeholders**:
   - Update status page (statuspage.io)
   - Send Slack notification to #incidents channel
   - Email affected tenant contacts

3. **Monitor for issues**:
   - Watch error rates in Grafana
   - Monitor database connection counts
   - Watch for replication lag on remaining secondaries

---

## 5. Evidence Integrity Verification

```bash
#!/bin/bash
# verify-evidence-integrity.sh

ENVIRONMENT="${1:-prod}"
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

echo "=== Verifying evidence file integrity ==="

# Get file counts per region
for region in us-east-1 eu-west-1 af-south-1 ap-southeast-1; do
  COUNT=$(aws s3api list-objects-v2 \
    --bucket "donordesk-${ENVIRONMENT}-evidence-${region}-${ACCOUNT_ID}" \
    --region "${region}" \
    --query 'length(Contents)' \
    --output text 2>/dev/null || echo "0")
  echo "${region}: ${COUNT} files"
done

# Verify replication lag
for region in eu-west-1 af-south-1 ap-southeast-1; do
  LAG=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/S3 \
    --metric-name ReplicationLatency \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
    --period 300 \
    --statistics Average \
    --dimensions Name=BucketName,Value="donordesk-${ENVIRONMENT}-evidence-primary-${ACCOUNT_ID}" Name=ReplicationDirection,Value=Replica Name=DestinationRegion,Value="${region}" \
    --region us-east-1 \
    --query 'Datapoints[0].Average' \
    --output text 2>/dev/null || echo "N/A")
  echo "Replication lag to ${region}: ${LAG}s"
done

echo "=== Integrity verification complete ==="
```

---

## 6. Quarterly Game Day Checklist

### Pre-Game Day
- [ ] Schedule game day with at least 2 weeks notice
- [ ] Notify all tenants of potential brief unavailability
- [ ] Prepare rollback plan for each test
- [ ] Assign roles: Commander, Scribe, Observer

### Game Day Tests

#### Test 1: Aurora Global Failover
```bash
# Simulate primary failure by stopping writer instance
aws rds stop-db-instance --db-instance-identifier "donordesk-prod-global-us-east-1-primary-0"

# Verify automatic failover completes within 60 seconds
# Verify no data loss

# Restore
aws rds start-db-instance --db-instance-identifier "donordesk-prod-global-us-east-1-primary-0"
```

#### Test 2: API Pod Evacuation
```bash
# Cordon all nodes in one AZ
kubectl cordon nodes -l topology.kubernetes.io/zone=us-east-1a

# Verify pods reschedule automatically
# Verify no traffic disruption (load balancer health checks)

# Uncordon
kubectl uncordon nodes -l topology.kubernetes.io/zone=us-east-1a
```

#### Test 3: S3 Replication Lag Recovery
```bash
# Upload 1000 test files to primary
# Verify all files replicate within 15 minutes
# Delete source files and verify replica integrity
```

#### Test 4: DNS Failover
```bash
# Manually update Route 53 to point to secondary
# Verify traffic redirects within TTL (60 seconds)
# Rollback
```

### Post-Game Day
- [ ] Document all findings and gaps
- [ ] Update runbook with lessons learned
- [ ] Schedule remediation for any failed checks
- [ ] Share summary with engineering team

---

## 7. Contacts & Escalation

| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | Platform Engineering | oncall@donordesk.com |
| Secondary On-Call | Infrastructure Lead | infra-lead@donordesk.com |
| Database Expert | Senior DBA | dba@donordesk.com |
| CTO | - | cto@donordesk.com |

### External Contacts
| Service | Contact | SLA |
|---------|---------|-----|
| AWS Support | Business Support | <1 hour response |
| Datadog | Account Team | <4 hour response |

---

## 8. Related Documents

- [Multi-Region Architecture](../architecture/multi-region.md)
- [Data Residency Policies](../../policies/donordesk/data_residency.rego)
- [BYOC Deployment Guide](./BYOC-DEPLOYMENT.md)
- [Helm Charts Reference](../helm)
