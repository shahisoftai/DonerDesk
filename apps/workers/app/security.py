"""Internal service-to-service authentication for the DonorDesk workers.

Every `/v1/*` route requires a valid `X-Internal-Token` matching `INTERNAL_TOKEN`.
Liveness (`/health`) and readiness (`/ready`) probes are intentionally exempt so
systemd can health-check the service without a secret.
"""
from __future__ import annotations

import hmac
import os

from fastapi import HTTPException, Request

INTERNAL_TOKEN_HEADER = "x-internal-token"


def require_internal_token(request: Request) -> None:
    expected = os.environ.get("INTERNAL_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=500, detail="Internal auth is not configured")
    provided = request.headers.get(INTERNAL_TOKEN_HEADER)
    if provided is None or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid internal token")
