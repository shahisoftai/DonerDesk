output "database_endpoint" {
  value = aws_db_instance.postgres.address
}

output "evidence_bucket" {
  value = aws_s3_bucket.evidence.id
}
