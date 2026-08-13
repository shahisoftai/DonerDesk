# DonorDesk BYOC (Bring Your Own Cloud) Deployment Guide

> **Current production reality (2026-08-13):** DonorDesk is deployed on a single
> **Contabo** host (PostgreSQL 16 + systemd), not yet in an AWS/GCP BYOC account.
> This guide documents the future managed-cloud target. See `contabo-ops.md` and
> `docs/CONTABO-LEAN-DEPLOYMENT.md` for the current single-host deployment.

## Overview

DonorDesk supports BYOC deployment, allowing enterprise customers to run the platform in their own AWS or GCP account. This provides:
- **Data sovereignty**: Tenant data stays within customer's cloud environment
- **Compliance**: Aligns with customer's existing security certifications (SOC2, ISO 27001)
- **Cost control**: Customer manages their own compute/storage costs
- **Isolation**: Dedicated resources, no shared infrastructure

---

## Supported Cloud Providers

| Provider | Status | Regions |
|----------|--------|---------|
| AWS | **GA** | us-east-1, us-west-2, eu-west-1, eu-central-1, af-south-1, ap-southeast-1 |
| GCP | **Beta** | us-central1, europe-west1, asia-southeast1 |
| Azure | **Planned** | East US, West Europe |

---

## Prerequisites

### For AWS BYOC

1. **AWS Account** with appropriate permissions
2. **EKS Cluster** (Kubernetes 1.28+)
3. **RDS PostgreSQL 16** (or Aurora PostgreSQL 16.1+)
4. **ElastiCache Redis 7** (or MemoryDB)
5. **S3 Bucket** with cross-region replication configured
6. **Secrets Manager** for sensitive configuration
7. **ACM Certificate** for TLS (or import your own)
8. **AWS CLI** configured with credentials

### IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "eks:ListClusters",
        "rds:DescribeDBInstances",
        "rds:DescribeDBClusters",
        "elasticache:DescribeCacheClusters",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "secretsmanager:GetSecretValue",
        "secretsmanager:CreateSecret",
        "acm:ListCertificates",
        "iam:CreateRole",
        "iam:AttachRolePolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Deployment Steps

### Step 1: Create EKS Cluster

```bash
# Create EKS cluster (eksctl)
eksctl create cluster \
  --name donordesk-byo \
  --region us-east-1 \
  --version 1.28 \
  --nodegroup-name standard-workers \
  --node-type m6i.xlarge \
  --nodes 3 \
  --nodes-min 3 \
  --nodes-max 20 \
  --with-oidc \
  --ssh-access \
  --managed

# Or via Terraform (see infra/terraform/modules/eks/)
```

### Step 2: Install Kubernetes Dependencies

```bash
# Add Helm repos
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add jetstack https://charts.jetstack.io
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install cert-manager for TLS
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# Install external-secrets operator for Secrets Manager integration
helm upgrade --install external-secrets \
  prometheus-community/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --set serviceAccount.name=external-secrets
```

### Step 3: Create Namespaces

```bash
kubectl create namespace donordesk
kubectl create namespace donordesk-infra
kubectl label namespaces donordesk donordesk.io/managed=true
```

### Step 4: Configure External Secrets

```yaml
# external-secrets-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: donordesk-secrets
  namespace: donordesk
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: donordesk-api-secrets
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: donordesk/prod/database
        property: url
    - secretKey: REDIS_URL
      remoteRef:
        key: donordesk/prod/redis
        property: url
    - secretKey: JWT_SECRET
      remoteRef:
        key: donordesk/prod/jwt
        property: secret
    - secretKey: ENCRYPTION_KEY
      remoteRef:
        key: donordesk/prod/encryption
        property: key
```

### Step 5: Configure IRSA (IAM Role for Service Account)

```bash
# Create OIDC provider
eksctl utils associate-iam-oidc-provider \
  --cluster donordesk-byo \
  --region us-east-1 \
  --approve

# Create IRSA role for API
aws iam create-role \
  --role-name DonorDeskAPIRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B716D3041E"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.us-east-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B716D3041E:sub": "system:serviceaccount:donordesk:donordesk-api"
        }
      }
    }]
  }'

# Attach policies
aws iam attach-role-policy \
  --role-name DonorDeskAPIRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

aws iam attach-role-policy \
  --role-name DonorDeskAPIRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

### Step 6: Deploy via Helm

```bash
# Clone DonorDesk Helm charts
git clone https://github.com/donordesk/helm-charts.git
cd helm-charts

# Override values for BYOC
cat > values-byo.yaml << 'EOF'
image:
  repository: 123456789.dkr.ecr.us-east-1.amazonaws.com/donordesk/api
  tag: "1.0.0"

byoc:
  enabled: true
  cloudProvider: "aws"
  customerAccountId: "123456789012"
  clusterName: "donordesk-byo"
  namespace: "donordesk"

multiRegion:
  enabled: true
  primaryRegion: "us-east-1"
  dataResidency: "US"

postgresql:
  enabled: false

externalDatabase:
  enabled: true
  host: "donordesk-cluster.cluster-abc123.us-east-1.rds.amazonaws.com"
  port: 5432
  database: "donordesk"
  username: "donordesk"
  existingSecret: "donordesk-database-secret"

redis:
  enabled: false

externalRedis:
  enabled: true
  host: "donordesk-redis.cluster-abc123.0001.usw2.cache.amazonaws.com"
  port: 6379
  existingSecret: "donordesk-redis-secret"

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: "arn:aws:iam::123456789012:role/DonorDeskAPIRole"

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: api.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: donordesk-tls
      hosts:
        - api.yourdomain.com

persistence:
  enabled: true
  storageClass: "gp3"

metrics:
  enabled: true
  serviceMonitor:
    enabled: true
EOF

# Install
helm upgrade --install donordesk-api ./donordesk-api \
  --namespace donordesk \
  --values values-byo.yaml \
  --wait \
  --timeout 10m
```

### Step 7: Verify Deployment

```bash
# Check pods
kubectl get pods -n donordesk

# Check services
kubectl get svc -n donordesk

# Check ingress
kubectl get ingress -n donordesk

# Verify API health
curl https://api.yourdomain.com/health

# Check logs
kubectl logs -n donordesk -l app=donordesk-api --tail=100
```

---

## Multi-Tenant Control Plane

For BYOC deployments, DonorDesk provides a control plane API for:
- **Tenant provisioning**: Create/manage tenant configurations
- **License management**: Track active seats and usage
- **Remote configuration**: Push config updates without redeployment
- **Telemetry**: Aggregated metrics (opt-in)

### Control Plane API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/tenants` | POST | Provision new tenant |
| `/api/v1/tenants/{id}` | GET/PATCH | Manage tenant config |
| `/api/v1/tenants/{id}/license` | GET | Check license status |
| `/api/v1/tenants/{id}/metrics` | POST | Report usage metrics |
| `/api/v1/deployments` | GET | List BYOC deployments |
| `/api/v1/deployments/{id}/heartbeat` | POST | Health check |

---

## BYOC-Specific Environment Variables

```bash
# Required for BYOC
DATA_RESIDENCY_REGION=US
BYOC_ENABLED=true
CONTROL_PLANE_URL=https://control.donordesk.com
CONTROL_PLANE_API_KEY=<provided-by-donordesk>
LICENSE_KEY=<provided-by-donordesk>

# Database
DATABASE_URL=postgresql://user:pass@host:5432/donordesk?schema=public

# Redis
REDIS_URL=redis://host:6379/0

# Storage
EVIDENCE_S3_BUCKET=donordesk-evidence-123456789012
EVIDENCE_S3_REGION=us-east-1

# Encryption
ENCRYPTION_KEY=<32-byte-hex-key>

# JWT
JWT_SECRET=<64-byte-secret>
JWT_ISSUER=https://api.yourdomain.com
```

---

## Monitoring & Alerting

### CloudWatch Integration

```yaml
# cloudwatch-metrics.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cloudwatch-agent-config
  namespace: donordesk
data:
  cwagent-entity.json: |
    {
      "agent": {
        "region": "us-east-1"
      },
      "logs": {
        "metrics_collected": {
          "cpu": true,
          "disk": true,
          "mem": true,
          "net": true
        }
      }
    }
```

### Prometheus Metrics

The API exposes Prometheus metrics at `/metrics`:
- `donordesk_http_requests_total` - Request count by status
- `donordesk_http_request_duration_seconds` - Latency histogram
- `donordesk_db_connections_active` - Active DB connections
- `donordesk_redis_commands_total` - Redis command count

---

## Upgrade Procedure

### Step 1: Download New Helm Chart

```bash
helm repo update
helm pull donordesk/donordesk-api --version 1.1.0
```

### Step 2: Run Database Migrations

```bash
kubectl run donordesk-migrations \
  --image=123456789.dkr.ecr.us-east-1.amazonaws.com/donordesk/api:1.1.0 \
  --restart=Never \
  --namespace donordesk \
  -- node dist/db/migrate.js

kubectl logs -n donordesk job/donordesk-migrations -f
```

### Step 3: Rolling Upgrade

```bash
helm upgrade donordesk-api ./donordesk-api-1.1.0 \
  --namespace donordesk \
  --values values-byo.yaml \
  --timeout 10m \
  --wait
```

### Step 4: Verify

```bash
# Check rollout status
kubectl rollout status deployment/donordesk-api -n donordesk

# Verify new version
curl https://api.yourdomain.com/health | jq .version
```

---

## Rollback Procedure

```bash
# Rollback to previous revision
helm rollback donordesk-api -n donordesk

# Or rollback to specific revision
helm rollback donordesk-api 3 -n donordesk

# Verify
kubectl rollout status deployment/donordesk-api -n donordesk
```

---

## Support

- **BYOC Support**: byoc-support@donordesk.com
- **Documentation**: https://docs.donordesk.com/byoc
- **Slack**: #donordesk-byo (enterprise customers only)
