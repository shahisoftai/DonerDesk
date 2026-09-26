from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class RegionRef(BaseModel):
    """A region the TS caller has already detected/mapped, supplied
    explicitly rather than re-detected here — the TS side's mammoth-based
    parser and this module's python-docx walk are different libraries with
    potentially different structural views; passing order+kind explicitly
    is what keeps them in sync rather than relying on both sides agreeing
    independently."""

    model_config = ConfigDict(extra="forbid")
    id: str
    kind: Literal["HEADING", "TABLE"]
    order: int
    placeholderKey: str


class InsertPlaceholdersRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    originalDocxBase64: str
    regions: list[RegionRef]


class InsertPlaceholdersResponse(BaseModel):
    templatedDocxBase64: str


class RenderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    templatedDocxBase64: str
    context: dict[str, str]


class RenderResponse(BaseModel):
    renderedDocxBase64: str
