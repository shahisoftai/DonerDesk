"""Document parsing for the DonorDesk workers.

Routing (which parser handles a file) is data-driven from the shared strategy
(`_strategy_data.py`), so it stays in lockstep with the TypeScript parser. The
per-format extraction logic lives here as small, single-responsibility helpers.
"""

from __future__ import annotations

import io
import logging
import os
from typing import Any

from fastapi import HTTPException

from ._strategy_data import PARSE_ROUTES
from .ocr import IMAGE_EXTENSIONS as _OCR_IMAGE_EXTENSIONS
from .ocr import OcrResult, OcrUnavailableError, describe, ocr_file

logger = logging.getLogger(__name__)


def route_file(filename: str, content_type: str | None) -> str:
    """Return the parser handler name for a file (first route match wins)."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    ct = content_type or ""
    for route in PARSE_ROUTES:
        if ext in route["extensions"]:
            return str(route["handler"])
        if any(needle in ct for needle in route["contentTypeContains"]):
            return str(route["handler"])
    return "filename"


def _parse_text(data: bytes) -> str:
    return data.decode("utf-8", errors="ignore")


def _parse_docx(data: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs)


def _parse_xlsx(data: bytes) -> str:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    parts: list[str] = []
    for sheet in wb.worksheets:
        parts.append(f"# {sheet.title}")
        for row in sheet.iter_rows(values_only=True):
            parts.append("\t".join(str(c) if c is not None else "" for c in row))
    return "\n".join(parts)


def _parse_pdf(data: bytes) -> str:
    from PyPDF2 import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


#: Largest upload `POST /v1/parse` reads. Mirrors `MAX_PARSE_FILE_BYTES` in the TypeScript domain.
MAX_PARSE_BYTES = int(os.environ.get("WORKER_MAX_PARSE_BYTES", str(20 * 1024 * 1024)))

_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "heic", "heif", "svg"}

_MESSAGES = {
    "FAILED": (
        "We could not read {name}. The file may be damaged or password-protected. "
        "Paste the text instead, or upload a fresh copy."
    ),
    "UNSUPPORTED": "{name} is an image or a file type we cannot read words from. Type or paste the text instead.",
    "EMPTY": "No readable text was found in {name}. If it is a scanned document, paste the text instead.",
}


def assess_extraction(filename: str, text: str, failed: bool = False, ocr: OcrResult | None = None) -> dict[str, Any]:
    """Whether a file's words were read (the same rule as `assessTextExtraction` in the TypeScript domain).

    Returns `{"status": EXTRACTED|EMPTY|FAILED|UNSUPPORTED, "message": ...}`; the message is a sentence for the person
    and is absent for EXTRACTED. A caller (the evidence flow) forwards both so a scan nobody could read is never
    recorded as evidence that was.
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    stripped = text.strip()
    if ocr is not None and stripped:
        # Read by machine: usable, but the person is told to check it against the original.
        details = {"confidence": ocr.confidence, "pagesRead": ocr.pages_read, "pagesTotal": ocr.pages_total}
        return {"status": "EXTRACTED", "note": describe(ocr), "ocr": details}
    if failed:
        status = "FAILED"
    elif ext in _IMAGE_EXTENSIONS or (stripped and stripped.lower() == filename.strip().lower()):
        status = "UNSUPPORTED"
    elif not stripped:
        status = "EMPTY"
    else:
        return {"status": "EXTRACTED"}
    return {"status": status, "message": _MESSAGES[status].format(name=filename)}


def _needs_ocr(handler: str, filename: str, text: str) -> bool:
    """A scan: a PDF with no text layer, or a photographed page. Files that already gave words are never read twice."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if handler == "pdf":
        return not text.strip()
    return ext in _OCR_IMAGE_EXTENSIONS


def _try_ocr(filename: str, data: bytes) -> OcrResult | None:
    """OCR is a best effort: when it is unavailable or fails, the file is reported as unreadable exactly as before."""
    try:
        return ocr_file(filename, data)
    except OcrUnavailableError:
        logger.info("OCR is not available; %s is reported as unreadable", filename)
    except Exception:
        logger.exception("OCR failed for %s", filename)
    return None


def parse(data: bytes, filename: str, content_type: str | None) -> dict[str, Any]:
    """Parse a file's bytes into extracted text (used by `POST /v1/parse`).

    This is the module the Kestra flow references (`from app.parsers import parse`). The response always says whether
    the words were read (`status`, and a `message` when they were not).
    """
    handler = route_file(filename, content_type)
    failed = False
    try:
        if handler == "filename":
            text = filename
        elif handler == "pdf":
            try:
                text = _parse_pdf(data)
            except Exception:  # best-effort, but never silent: the response says it failed.
                text = ""
                failed = True
        elif handler == "docx":
            try:
                text = _parse_docx(data)
            except Exception:
                logger.exception("docx parse failed for %s", filename)
                text = ""
                failed = True
        elif handler == "xlsx":
            try:
                text = _parse_xlsx(data)
            except Exception:
                logger.exception("xlsx parse failed for %s", filename)
                text = ""
                failed = True
        else:
            text = _parse_text(data)
    except HTTPException:
        raise
    except Exception as exc:
        # The technical reason goes to the log, never to the caller (it can carry file paths and library internals).
        logger.exception("parse failed for %s", filename)
        raise HTTPException(status_code=400, detail="The file could not be processed.") from exc
    ocr = None
    if _needs_ocr(handler, filename, text):
        ocr = _try_ocr(filename, data)
        if ocr is not None and ocr.text.strip():
            text, failed = ocr.text, False
        else:
            ocr = None
    return {"text": text, "filename": filename, "size": len(data), **assess_extraction(filename, text, failed, ocr)}
