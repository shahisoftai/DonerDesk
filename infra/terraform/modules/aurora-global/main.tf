################################################################################
# Aurora Global Database Module
# Creates a global Aurora PostgreSQL cluster with primary and secondary regions
################################################################################

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
}

variable "primary_region" {
  type        = string
  description = "Primary AWS region for the global database"
}

variable "secondary_regions" {
  type        = list(string)
  description = "List of secondary AWS regions for read replicas"
}

variable "database_password" {
  type        = string
  sensitive   = true
  description = "Master password for Aurora cluster"
}

variable "instance_class" {
  type        = string
  default     = "db.r8g.large"
  description = "Aurora instance class"
}

variable "allocated_storage_gb" {
  type        = number
  default     = 100
  description = "Allocated storage in GB"
}

variable "backup_retention_days" {
  type        = number
  default     = 30
  description = "Backup retention period in days"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags to apply to all resources"
}

locals {
  cluster_id = "donordesk-${var.environment}-global"
}

################################################################################
# Primary Region Aurora Cluster
################################################################################

resource "aws_rds_cluster" "primary" {
  cluster_identifier     = local.cluster_id
  engine                 = "aurora-postgresql"
  engine_version         = "16.1"
  engine_mode            = "global"
  database_name          = "donordesk"
  master_username        = "donordesk_admin"
  master_password        = var.database_password
  storage_encrypted      = true
  backup_retention_period = var.backup_retention_days
  preferred_backup_window = "03:00-04:00"
  preferred_maintenance_window = "mon:04:00-mon:05:00"
  global_cluster_identifier = aws_rds_global_cluster.global.id

  serverlessv2_scaling_configuration {
    min_capacity = 2
    max_capacity = 32
  }

  tags = merge(var.tags, { Region = "PRIMARY" })
}

resource "aws_rds_cluster_instance" "primary" {
  count = 2
  identifier_prefix = "${local.cluster_id}-primary"
  cluster_identifier = aws_rds_cluster.primary.id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.primary.engine
  engine_version     = aws_rds_cluster.primary.engine_version
  publicly_accessible = false
  promotion_tier     = count.index == 0 ? 0 : 1

  tags = merge(var.tags, { Region = "PRIMARY", InstanceRole = count.index == 0 ? "WRITER" : "READER" })
}

################################################################################
# Global Cluster (manages replication topology)
################################################################################

resource "aws_rds_global_cluster" "global" {
  global_cluster_identifier = local.cluster_id
  engine                    = "aurora-postgresql"
  engine_version            = "16.1"
  database_name             = "donordesk"
  master_username           = "donordesk_admin"
  master_password           = var.database_password
  storage_encrypted         = true

  tags = var.tags
}

################################################################################
# Secondary Region Clusters (Managed via Global Cluster)
################################################################################

resource "aws_rds_cluster" "secondary" {
  for_each = toset(var.secondary_regions)

  cluster_identifier     = "${local.cluster_id}-${each.key}"
  engine                 = "aurora-postgresql"
  engine_version         = "16.1"
  engine_mode            = "global"
  database_name          = "donordesk"
  master_username        = "donordesk_admin"
  master_password        = var.database_password
  storage_encrypted      = true
  global_cluster_identifier = aws_rds_global_cluster.global.id

  serverlessv2_scaling_configuration {
    min_capacity = 2
    max_capacity = 16
  }

  tags = merge(var.tags, { Region = each.key })
}

resource "aws_rds_cluster_instance" "secondary" {
  for_each = { for i, r in toset(var.secondary_regions) : r => i }

  identifier_prefix = "${local.cluster_id}-${var.secondary_regions[each.value]}"
  cluster_identifier = aws_rds_cluster.secondary[var.secondary_regions[each.value]].id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.secondary[var.secondary_regions[each.value]].engine
  engine_version     = aws_rds_cluster.secondary[var.secondary_regions[each.value]].engine_version
  publicly_accessible = false
  promotion_tier     = 2

  tags = merge(var.tags, { Region = var.secondary_regions[each.value], InstanceRole = "READER" })
}

################################################################################
# Outputs
################################################################################

output "primary_endpoint" {
  value       = aws_rds_cluster.primary.endpoint
  description = "Primary Aurora cluster endpoint (writer)"
}

output "primary_reader_endpoint" {
  value       = aws_rds_cluster.primary.reader_endpoint
  description = "Primary Aurora cluster reader endpoint"
}

output "secondary_endpoints" {
  value = {
    for region, cluster in aws_rds_cluster.secondary :
    region => cluster.endpoint
  }
  description = "Map of secondary region endpoints"
}

output "global_cluster_id" {
  value       = aws_rds_global_cluster.global.id
  description = "Global cluster identifier"
}
