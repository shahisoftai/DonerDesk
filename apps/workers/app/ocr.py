"""Optical character recognition for scanned PDFs and photographed pages.

Used only when a file has no text layer: the ordinary parsers run first, and OCR is the fallback so a scan is read
instead of refused. Pure Python wheels (`pypdfium2` renders PDF pages, `rapidocr-onnxruntime` reads them), so nothing
is installed on the host outside the worker's virtual environment. OCR is approximate: the result carries a
confidence, and the people who see it are told to check names and numbers.

The engine and the page renderer are injectable so the logic is tested without the models.
"""

from __future__ import annotations

import io
import logging
import os
import threading
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

logger = logging.getLogger(__name__)

#: Pages read per file; more are left out and the result says so.
MAX_PAGES = int(os.environ.get("OCR_MAX_PAGES", "20"))
#: Resolution pages are rendered at. Higher reads small print better and costs time.
RENDER_DPI = int(os.environ.get("OCR_RENDER_DPI", "150"))
#: Lines the engine is less sure of than this are kept but counted as "uncertain".
UNCERTAIN_BELOW = 0.6

#: Files read at the same time. OCR is heavy on the processor, so scans queue rather than compete with drafting.
_SLOTS = threading.Semaphore(int(os.environ.get("OCR_CONCURRENCY", "1")))

IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tif", "tiff", "webp"}


class OcrUnavailableError(RuntimeError):
    """The OCR libraries are not installed (or disabled): the caller reports that scans cannot be read here."""


@dataclass(frozen=True)
class OcrLine:
    text: str
    confidence: float
    #: Top-left of the line on the page, used only to put lines in reading order.
    x: float
    y: float


class OcrEngine(Protocol):
    def read(self, image: Any) -> Sequence[OcrLine]: ...


@dataclass(frozen=True)
class OcrResult:
    text: str
    pages_read: int
    pages_total: int
    #: Mean confidence of the lines read, 0 to 1; None when nothing was read.
    confidence: float | None
    uncertain_lines: int

    @property
    def truncated(self) -> bool:
        return self.pages_read < self.pages_total


def ocr_enabled() -> bool:
    return os.environ.get("OCR_ENABLED", "1") != "0"


class _RapidOcrEngine:
    """The default engine. The model loads once, on first use."""

    def __init__(self) -> None:
        from rapidocr_onnxruntime import RapidOCR  # imported late: the dependency is optional

        self._ocr = RapidOCR()

    def read(self, image: Any) -> Sequence[OcrLine]:
        result, _elapsed = self._ocr(image)
        lines: list[OcrLine] = []
        for box, text, score in result or []:
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            lines.append(OcrLine(text=str(text), confidence=float(score), x=float(min(xs)), y=float(min(ys))))
        return lines


_engine: OcrEngine | None = None


def default_engine() -> OcrEngine:
    global _engine
    if not ocr_enabled():
        raise OcrUnavailableError("OCR is switched off on this server.")
    if _engine is None:
        try:
            _engine = _RapidOcrEngine()
        except ImportError as exc:
            raise OcrUnavailableError("OCR is not installed on this server.") from exc
    return _engine


def render_pdf_pages(data: bytes, max_pages: int = MAX_PAGES, dpi: int = RENDER_DPI) -> tuple[list[Any], int]:
    """Renders up to `max_pages` pages to images (numpy arrays). Returns the images and the document's page count."""
    try:
        import numpy as np
        import pypdfium2 as pdfium
    except ImportError as exc:
        raise OcrUnavailableError("OCR is not installed on this server.") from exc
    pdf = pdfium.PdfDocument(data)
    total = len(pdf)
    images = []
    for index in range(min(total, max_pages)):
        bitmap = pdf[index].render(scale=dpi / 72)
        images.append(np.array(bitmap.to_pil().convert("RGB")))
    return images, total


def load_image(data: bytes) -> Any:
    try:
        import numpy as np
        from PIL import Image
    except ImportError as exc:
        raise OcrUnavailableError("OCR is not installed on this server.") from exc
    return np.array(Image.open(io.BytesIO(data)).convert("RGB"))


def _reading_order(lines: Sequence[OcrLine]) -> list[OcrLine]:
    """Top to bottom, and left to right within a line (lines whose tops are within 12 px count as one row)."""
    return sorted(lines, key=lambda line: (round(line.y / 12), line.x))


def ocr_pages(images: Sequence[Any], pages_total: int, engine: OcrEngine) -> OcrResult:
    texts: list[str] = []
    scores: list[float] = []
    uncertain = 0
    for image in images:
        lines = _reading_order(engine.read(image))
        texts.append("\n".join(line.text for line in lines if line.text.strip()))
        scores.extend(line.confidence for line in lines if line.text.strip())
        uncertain += sum(1 for line in lines if line.text.strip() and line.confidence < UNCERTAIN_BELOW)
    text = "\n\n".join(t for t in texts if t)
    return OcrResult(
        text=text,
        pages_read=len(images),
        pages_total=pages_total,
        confidence=round(sum(scores) / len(scores), 3) if scores else None,
        uncertain_lines=uncertain,
    )


def ocr_pdf(
    data: bytes,
    engine: OcrEngine | None = None,
    render: Callable[..., tuple[list[Any], int]] = render_pdf_pages,
) -> OcrResult:
    images, total = render(data)
    return ocr_pages(images, total, engine or default_engine())


def ocr_image(
    data: bytes,
    engine: OcrEngine | None = None,
    load: Callable[[bytes], Any] = load_image,
) -> OcrResult:
    return ocr_pages([load(data)], 1, engine or default_engine())


def ocr_file(filename: str, data: bytes, engine: OcrEngine | None = None) -> OcrResult | None:
    """OCR for a PDF or an image; None for any other kind of file."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "pdf":
        with _SLOTS:
            return ocr_pdf(data, engine)
    if ext in IMAGE_EXTENSIONS:
        with _SLOTS:
            return ocr_image(data, engine)
    return None


def describe(result: OcrResult) -> str:
    """A sentence for the person: it was read by machine, how sure it was, and what was left out."""
    parts = ["Read from the scanned page by text recognition: check names and numbers against the original."]
    if result.uncertain_lines:
        n = result.uncertain_lines
        parts.append(f"{n} line{'s' if n != 1 else ''} could not be read clearly.")
    if result.truncated:
        parts.append(f"Only the first {result.pages_read} of {result.pages_total} pages were read.")
    return " ".join(parts)
