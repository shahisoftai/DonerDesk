package donordesk.authz

import future.keywords.if

default allow := false

allow if {
    input.action == "read"
    input.tenant_id == input.resource_tenant_id
}

allow if {
    input.action == "write"
    input.tenant_id == input.resource_tenant_id
    input.role != "INVITED"
}

allow if {
    input.action == "delete"
    input.role == "ADMIN"
    input.tenant_id == input.resource_tenant_id
}

deny_cross_region if {
    input.data_residency != "DEFAULT"
    input.resource_region != input.data_residency
    input.action == "write"
}

violation["cross_region_write"] if deny_cross_region
