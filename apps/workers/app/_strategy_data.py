# GENERATED FILE - do not edit by hand.
# Source: packages/contracts/src/strategies/heuristic-rules.json
# Regenerate with: pnpm --filter @donordesk/contracts generate:workers

from typing import Any

EVIDENCE_KEYWORDS: list[dict[str, Any]] = [
  {
    "keyword": "attendance",
    "evidenceType": "ATTENDANCE_SHEET",
    "confidence": "HIGH"
  },
  {
    "keyword": "photo",
    "evidenceType": "PHOTO",
    "confidence": "HIGH"
  },
  {
    "keyword": "picture",
    "evidenceType": "PHOTO",
    "confidence": "HIGH"
  },
  {
    "keyword": "distribution",
    "evidenceType": "DISTRIBUTION_LIST",
    "confidence": "HIGH"
  },
  {
    "keyword": "training",
    "evidenceType": "TRAINING_RECORD",
    "confidence": "MEDIUM"
  },
  {
    "keyword": "visit",
    "evidenceType": "FIELD_VISIT_REPORT",
    "confidence": "MEDIUM"
  },
  {
    "keyword": "monitoring",
    "evidenceType": "MONITORING_REPORT",
    "confidence": "MEDIUM"
  },
  {
    "keyword": "kobo",
    "evidenceType": "KOBO_ODK_EXPORT",
    "confidence": "HIGH"
  },
  {
    "keyword": "odk",
    "evidenceType": "KOBO_ODK_EXPORT",
    "confidence": "HIGH"
  },
  {
    "keyword": "procurement",
    "evidenceType": "PROCUREMENT_DOCUMENT",
    "confidence": "MEDIUM"
  },
  {
    "keyword": "approval",
    "evidenceType": "APPROVAL_DOCUMENT",
    "confidence": "MEDIUM"
  },
  {
    "keyword": "beneficiary",
    "evidenceType": "BENEFICIARY_LIST",
    "confidence": "HIGH"
  },
  {
    "keyword": "minutes",
    "evidenceType": "MEETING_MINUTES",
    "confidence": "MEDIUM"
  },
  {
    "keyword": "case",
    "evidenceType": "CASE_STUDY",
    "confidence": "LOW"
  },
  {
    "keyword": "financial",
    "evidenceType": "FINANCIAL_DOCUMENT",
    "confidence": "MEDIUM"
  },
  {
    "keyword": "invoice",
    "evidenceType": "FINANCIAL_DOCUMENT",
    "confidence": "HIGH"
  },
  {
    "keyword": "supplier",
    "evidenceType": "SUPPLIER_DOCUMENT",
    "confidence": "MEDIUM"
  }
]

SENSITIVE_KEYWORDS: list[str] = [
  "beneficiary name",
  "phone",
  "cnic",
  "national id",
  "passport",
  "children",
  "medical",
  "diagnosis",
  "patient"
]

ACTIVITY_TITLE_MATCH_PREFIX: int = 6
INDICATOR_NAME_MATCH_PREFIX: int = 8

PARSE_ROUTES: list[dict[str, Any]] = [
  {
    "handler": "docx",
    "extensions": [
      "docx"
    ],
    "contentTypeContains": [
      "officedocument.wordprocessingml"
    ]
  },
  {
    "handler": "xlsx",
    "extensions": [
      "xlsx"
    ],
    "contentTypeContains": [
      "spreadsheetml"
    ]
  },
  {
    "handler": "text",
    "extensions": [
      "txt"
    ],
    "contentTypeContains": [
      "text/"
    ]
  },
  {
    "handler": "csv",
    "extensions": [
      "csv"
    ],
    "contentTypeContains": []
  },
  {
    "handler": "pdf",
    "extensions": [
      "pdf"
    ],
    "contentTypeContains": [
      "application/pdf"
    ]
  },
  {
    "handler": "filename",
    "extensions": [],
    "contentTypeContains": []
  }
]
