"""DonorDesk async workers (FastAPI).

Routes:
  GET  /health              liveness (unauthenticated)
  GET  /ready               readiness (unauthenticated)
  POST /v1/parse            parse a document (multipart upload) [X-Internal-Token]
  POST /v1/suggest-tags     suggest evidence tags                 [X-Internal-Token]
  POST /v1/polish           polish activity narrative             [X-Internal-Token]
  POST /v1/draft-section    draft a report section (stub)         [X-Internal-Token]

Every `/v1/*` route requires `X-Internal-Token` (see app.security). All routes
are intended to be invoked through Kestra flows on a loopback-bound process.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, FastAPI, File, UploadFile

from .drafting import DraftSectionRequest, draft_section
from .parsers import parse
from .polishing import PolishRequest, polish
from .security import require_internal_token
from .tagging import SuggestTagsRequest, suggest_tags

app = FastAPI(title="DonorDesk Workers", version="0.2.0")

v1 = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_token)])


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "donordesk-workers"}


@app.get("/ready")
def ready() -> dict[str, Any]:
    return {"status": "ready"}


@v1.post("/parse")
async def parse_document(file: UploadFile = File(...)) -> dict[str, Any]:
    data = await file.read()
    return parse(data, file.filename or "upload.bin", file.content_type)


@v1.post("/suggest-tags")
def suggest_tags_route(req: SuggestTagsRequest) -> dict[str, Any]:
    return suggest_tags(req)


@v1.post("/polish")
def polish_route(req: PolishRequest) -> dict[str, Any]:
    return polish(req)


@v1.post("/draft-section")
def draft_section_route(req: DraftSectionRequest) -> dict[str, Any]:
    return draft_section(req)


app.include_router(v1)
