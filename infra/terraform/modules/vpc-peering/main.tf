################################################################################
# VPC Peering Module for Cross-Region Private Connectivity
################################################################################

variable "environment" {
  type        = string
  description = "Deployment environment"
}

variable "primary_region" {
  type        = string
  description = "Primary region"
}

variable "secondary_regions" {
  type        = list(string)
  description = "Secondary regions to peer with primary"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags to apply"
}

locals {
  primary_vpc_cidr = "10.40.0.0/16"
}

################################################################################
# Route 53 Private Hosted Zones per Region
################################################################################

resource "aws_route53_zone" "private_primary" {
  name = "donordesk.internal"

  vpc {
    vpc_id = var.primary_vpc_id
  }

  tags = merge(var.tags, { Region = var.primary_region })
}

################################################################################
# Cross-Region VPC Endpoints (S3, Secrets Manager, SQS)
################################################################################

resource "aws_vpc_endpoint" "s3_primary" {
  vpc_id            = var.primary_vpc_id
  service_name      = "com.amazonaws.${var.primary_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.primary_route_table_ids

  tags = merge(var.tags, { Service = "S3" })
}

################################################################################
# Transit Gateway for Cross-Region Communication (optional, for high-throughput)
################################################################################

resource "aws_ec2_transit_gateway" "donordesk" {
  description = "DonorDesk transit gateway for multi-region connectivity"
  amazon_side_asn = 64512
  auto_accept_shared_attachments = "enable"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"
  dns_support = "enable"
  vpn_ecmp_support = "enable"

  tags = merge(var.tags, { Type = "TransitGateway" })
}

################################################################################
# Outputs
################################################################################

output "transit_gateway_id" {
  value       = aws_ec2_transit_gateway.donordesk.id
  description = "Transit gateway ID for cross-region peering"
}

output "private_hosted_zone_id" {
  value       = aws_route53_zone.private_primary.zone_id
  description = "Private hosted zone ID"
}
