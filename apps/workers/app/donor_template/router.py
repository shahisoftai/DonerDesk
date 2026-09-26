"""FastAPI routes for donor template rendering (docxtpl).

Routes:
  POST /v1/donor-template/insert-placeholders   (run once, at mapping approval)
  POST /v1/donor-template/render                (run on every export)

Auth inherited from the parent `v1` router (X-Internal-Token), same as
ai_reporter. Errors are returned as 422 with a plain message rather than
propagating a raw 500, so the TS caller's Result-based client gets a clean
failure to fall back on.
"""
from __future__ import annotations

import base64

from fastapi import APIRouter, HTTPException

from .models import (
    InsertPlaceholdersRequest,
    InsertPlaceholdersResponse,
    RenderRequest,
    RenderResponse,
)
from .placeholder_inserter import insert_placeholders
from .renderer import render as render_docx

router = APIRouter(prefix="/donor-template", tags=["donor-template"])


@router.post("/insert-placeholders", response_model=InsertPlaceholdersResponse)
def insert_placeholders_route(req: InsertPlaceholdersRequest) -> InsertPlaceholdersResponse:
    try:
        original_bytes = base64.b64decode(req.originalDocxBase64)
        templated_bytes = insert_placeholders(original_bytes, req.regions)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"placeholder insertion failed: {exc}") from exc
    return InsertPlaceholdersResponse(templatedDocxBase64=base64.b64encode(templated_bytes).decode("ascii"))


@router.post("/render", response_model=RenderResponse)
def render_route(req: RenderRequest) -> RenderResponse:
    try:
        templated_bytes = base64.b64decode(req.templatedDocxBase64)
        rendered_bytes = render_docx(templated_bytes, req.context)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"docxtpl render failed: {exc}") from exc
    return RenderResponse(renderedDocxBase64=base64.b64encode(rendered_bytes).decode("ascii"))
