################################################################################
# Multi-Region Terraform Configuration
# Supports: EU (Frankfurt), US (Virginia), AFRICA (Nairobi), ASIA (Singapore)
# Uses AWS Aurora Global Database for cross-region replication
################################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

################################################################################
# Provider Configurations per Region
################################################################################

provider "aws" {
  alias  = "eu_west_1"
  region = "eu-west-1"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

provider "aws" {
  alias  = "af_nairobi"
  region = "af-south-1"
}

provider "aws" {
  alias  = "ap_singapore"
  region = "ap-southeast-1"
}

################################################################################
# Data Residency Label Definitions
################################################################################

variable "data_residency_regions" {
  type = map(object({
    primary   = string
    secondary = string
    backup    = string
  }))
  default = {
    EU = {
      primary   = "eu-west-1"
      secondary = "eu-central-1"
      backup    = "us-east-1"
    }
    US = {
      primary   = "us-east-1"
      secondary = "us-west-2"
      backup    = "eu-west-1"
    }
    AFRICA = {
      primary   = "af-south-1"
      secondary = "af-north-1"
      backup    = "eu-west-1"
    }
    ASIA = {
      primary   = "ap-southeast-1"
      secondary = "ap-south-1"
      backup    = "us-east-1"
    }
  }
  description = "Map of data residency labels to AWS region triples (primary, secondary, backup)"
}

################################################################################
# Environment Variable
################################################################################

variable "environment" {
  type    = string
  default = "prod"
}

################################################################################
# Aurora Global Database for Multi-Region Replication
# Primary in one region, secondaries in others via global database cluster
################################################################################

module "aurora_global" {
  source = "./modules/aurora-global"

  environment          = var.environment
  primary_region       = "us-east-1"
  secondary_regions    = ["eu-west-1", "af-south-1", "ap-southeast-1"]
  database_password    = var.database_password
  instance_class       = "db.r8g.large"
  allocated_storage_gb = 100
  backup_retention_days = 30
  tags = {
    Application   = "DonorDesk"
    Environment   = var.environment
    ManagedBy     = "Terraform"
    Replication   = "global"
  }
}

################################################################################
# Cross-Region VPC Peering (for private connectivity)
################################################################################

module "vpc_peering" {
  source = "./modules/vpc-peering"

  environment       = var.environment
  primary_region    = "us-east-1"
  secondary_regions = ["eu-west-1", "af-south-1", "ap-southeast-1"]

  tags = {
    Application = "DonorDesk"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

################################################################################
# S3 Cross-Region Replication for Evidence Files
################################################################################

resource "aws_s3_bucket" "evidence_primary" {
  provider = aws.us_east_1
  bucket   = "donordesk-${var.environment}-evidence-primary-${data.aws_caller_identity.current.account_id}"
  tags     = { Application = "DonorDesk", Environment = var.environment, DataRegion = "PRIMARY" }
}

resource "aws_s3_bucket_versioning" "evidence_primary" {
  provider = aws.us_east_1
  bucket   = aws_s3_bucket.evidence_primary.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_replication_config" "evidence" {
  provider = aws.us_east_1
  bucket   = aws_s3_bucket.evidence_primary.id
  role     = aws_iam_role.s3_replication.arn

  rule {
    id     = "replicate-evidence"
    status = "Enabled"
    destination {
      bucket        = aws_s3_bucket.evidence_eu.arn
      storage_class = "STANDARD"
      replication_time {
        status  = "Enabled"
        minutes = 15
      }
    }
    filter { tags {} }
  }
}

resource "aws_s3_bucket" "evidence_eu" {
  provider = aws.eu_west_1
  bucket   = "donordesk-${var.environment}-evidence-eu-${data.aws_caller_identity.current.account_id}"
  tags     = { Application = "DonorDesk", Environment = var.environment, DataRegion = "EU" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence_eu" {
  provider = aws.eu_west_1
  bucket   = aws_s3_bucket.evidence_eu.id
  rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }
}

resource "aws_s3_bucket" "evidence_africa" {
  provider = aws.af_nairobi
  bucket   = "donordesk-${var.environment}-evidence-af-${data.aws_caller_identity.current.account_id}"
  tags     = { Application = "DonorDesk", Environment = var.environment, DataRegion = "AFRICA" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence_africa" {
  provider = aws.af_nairobi
  bucket   = aws_s3_bucket.evidence_africa.id
  rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }
}

resource "aws_s3_bucket" "evidence_asia" {
  provider = aws.ap_singapore
  bucket   = "donordesk-${var.environment}-evidence-asia-${data.aws_caller_identity.current.account_id}"
  tags     = { Application = "DonorDesk", Environment = var.environment, DataRegion = "ASIA" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence_asia" {
  provider = aws.ap_singapore
  bucket   = aws_s3_bucket.evidence_asia.id
  rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }
}

################################################################################
# IAM Role for S3 Cross-Region Replication
################################################################################

resource "aws_iam_role" "s3_replication" {
  name = "donordesk-${var.environment}-s3-replication"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "s3_replication_policy" {
  name = "donordesk-${var.environment}-s3-replication-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObjectVersion", "s3:GetObjectVersionAcl"]
        Resource = "${aws_s3_bucket.evidence_primary.arn}/*"
      },
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:PutObjectAcl"]
        Resource = [
          "${aws_s3_bucket.evidence_eu.arn}/*",
          "${aws_s3_bucket.evidence_africa.arn}/*",
          "${aws_s3_bucket.evidence_asia.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_replication" {
  role       = aws_iam_role.s3_replication.name
  policy_arn = aws_iam_policy.s3_replication_policy.arn
}

################################################################################
# Route 53 Cross-Region Health Checks & Failover
################################################################################

resource "aws_route53_health_check" "primary_region" {
  provider           = aws.us_east_1
  fqdn               = "api.donordesk.com"
  port               = 443
  type               = "HTTPS"
  resource_path      = "/health"
  failure_threshold  = 3
  request_interval   = 30

  tags = { Application = "DonorDesk", Environment = var.environment }
}

resource "aws_route53_health_check" "secondary_region" {
  provider           = aws.eu_west_1
  fqdn               = "api.donordesk.eu"
  port               = 443
  type               = "HTTPS"
  resource_path      = "/health"
  failure_threshold  = 3
  request_interval   = 30

  tags = { Application = "DonorDesk", Environment = var.environment }
}

################################################################################
# CloudWatch Cross-Region Dashboards
################################################################################

resource "aws_cloudwatch_dashboard" "multi_region" {
  dashboard_name = "donordesk-${var.environment}-global"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["DonorDesk/API", "Latency", { stat = "p99" }],
            [".", "Errors", { stat = "Sum" }],
            [".", "Requests", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Average"
          region = "us-east-1"
          title  = "API Metrics - Primary"
        }
      }
    ]
  })
}

################################################################################
# Secrets Manager Cross-Region Replication
################################################################################

resource "aws_secretsmanager_secret" "donordesk_master" {
  name        = "donordesk/${var.environment}/master"
  description = "DonorDesk master key for ${var.environment}"

  recovery_window_in_days = 30

  tags = { Application = "DonorDesk", Environment = var.environment }
}

resource "aws_secretsmanager_secret" "donordesk_master_eu" {
  provider    = aws.eu_west_1
  name        = "donordesk/${var.environment}/master"
  description = "DonorDesk master key for ${var.environment} (EU replica)"

  recovery_window_in_days = 30

  tags = { Application = "DonorDesk", Environment = var.environment }
}

################################################################################
# Output Values
################################################################################

output "primary_region_endpoint" {
  value       = module.aurora_global.primary_endpoint
  description = "Aurora primary cluster endpoint"
}

output "secondary_region_endpoints" {
  value       = module.aurora_global.secondary_endpoints
  description = "Aurora secondary cluster endpoints per region"
}

output "evidence_bucket_regions" {
  value = {
    primary = aws_s3_bucket.evidence_primary.id
    eu      = aws_s3_bucket.evidence_eu.id
    africa  = aws_s3_bucket.evidence_africa.id
    asia    = aws_s3_bucket.evidence_asia.id
  }
  description = "Evidence S3 buckets per region"
}

output "replication_role_arn" {
  value       = aws_iam_role.s3_replication.arn
  description = "IAM role ARN used for S3 cross-region replication"
}
