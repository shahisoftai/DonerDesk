package donordesk.data_residency

import future.keywords.if

allowed_regions := {"EU", "US", "AFRICA", "ASIA", "DEFAULT"}

default allow := true

allow if {
    input.organization_data_residency == "DEFAULT"
}

allow if {
    input.organization_data_residency == input.storage_region
}

allow if {
    input.action == "read"
}

deny_residency_violation if {
    input.organization_data_residency != "DEFAULT"
    input.organization_data_residency != input.storage_region
    input.action == "write"
}

violation["data_residency_violation"] if deny_residency_violation
