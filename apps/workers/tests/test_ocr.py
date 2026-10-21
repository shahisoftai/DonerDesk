"""OCR fallback: the logic runs with a fake engine; one real smoke test runs when the OCR libraries are installed."""

from __future__ import annotations

import io

import pytest

from app import ocr, parsers
from app.ocr import OcrLine, OcrUnavailableError


class FakeEngine:
    def __init__(self, pages: list[list[OcrLine]]) -> None:
        self.pages = pages
        self.calls = 0

    def read(self, image):  # noqa: ANN001
        lines = self.pages[self.calls]
        self.calls += 1
        return lines


def _render(count: int, total: int | None = None):
    def render(_data: bytes):
        return [object()] * count, total if total is not None else count

    return render


def test_lines_are_read_in_reading_order_and_scored():
    engine = FakeEngine([[OcrLine("second row", 0.9, 10, 40), OcrLine("right", 0.4, 300, 10), OcrLine("left", 0.95, 10, 12)]])
    result = ocr.ocr_pdf(b"x", engine, render=_render(1))
    assert result.text.splitlines() == ["left", "right", "second row"]
    assert result.uncertain_lines == 1
    assert result.confidence == pytest.approx(0.75)
    assert not result.truncated


def test_a_long_document_says_how_many_pages_were_read():
    engine = FakeEngine([[OcrLine("p1", 0.9, 0, 0)], [OcrLine("p2", 0.9, 0, 0)]])
    result = ocr.ocr_pdf(b"x", engine, render=_render(2, total=30))
    assert result.truncated
    assert "Only the first 2 of 30 pages were read." in ocr.describe(result)


def test_a_blank_page_gives_no_text_and_no_confidence():
    result = ocr.ocr_pdf(b"x", FakeEngine([[]]), render=_render(1))
    assert result.text == ""
    assert result.confidence is None


def test_other_file_types_are_not_ocrd():
    assert ocr.ocr_file("notes.docx", b"x", FakeEngine([])) is None


def test_a_scanned_pdf_is_read_instead_of_refused(monkeypatch):
    result = ocr.ocr_pages([object()], 1, FakeEngine([[OcrLine("Water points drilled: 12", 0.92, 0, 0)]]))
    monkeypatch.setattr(parsers, "ocr_file", lambda _name, _data: result)
    monkeypatch.setattr(parsers, "_parse_pdf", lambda _data: "")
    out = parsers.parse(b"%PDF", "scan.pdf", "application/pdf")
    assert out["status"] == "EXTRACTED"
    assert "Water points drilled: 12" in out["text"]
    assert "check names and numbers" in out["note"]
    assert out["ocr"]["pagesRead"] == 1


def test_a_pdf_with_a_text_layer_is_never_ocrd(monkeypatch):
    def boom(_name, _data):
        raise AssertionError("OCR must not run when the file already gave words")

    monkeypatch.setattr(parsers, "ocr_file", boom)
    monkeypatch.setattr(parsers, "_parse_pdf", lambda _data: "Real text layer")
    out = parsers.parse(b"%PDF", "report.pdf", "application/pdf")
    assert out["status"] == "EXTRACTED"
    assert "note" not in out


def test_when_ocr_is_unavailable_the_file_is_reported_as_before(monkeypatch):
    def unavailable(_name, _data):
        raise OcrUnavailableError("not installed")

    monkeypatch.setattr(parsers, "ocr_file", unavailable)
    monkeypatch.setattr(parsers, "_parse_pdf", lambda _data: "")
    out = parsers.parse(b"%PDF", "scan.pdf", "application/pdf")
    assert out["status"] == "EMPTY"
    out = parsers.parse(b"\x89PNG", "photo.png", "image/png")
    assert out["status"] == "UNSUPPORTED"


def test_a_failing_engine_does_not_break_parsing(monkeypatch):
    def broken(_name, _data):
        raise RuntimeError("model crashed")

    monkeypatch.setattr(parsers, "ocr_file", broken)
    monkeypatch.setattr(parsers, "_parse_pdf", lambda _data: "")
    assert parsers.parse(b"%PDF", "scan.pdf", "application/pdf")["status"] == "EMPTY"


def test_ocr_can_be_switched_off(monkeypatch):
    monkeypatch.setenv("OCR_ENABLED", "0")
    monkeypatch.setattr(ocr, "_engine", None)
    with pytest.raises(OcrUnavailableError):
        ocr.default_engine()


def test_real_engine_reads_rendered_text():
    pytest.importorskip("rapidocr_onnxruntime")
    pil = pytest.importorskip("PIL.Image")
    draw = pytest.importorskip("PIL.ImageDraw")
    font_mod = pytest.importorskip("PIL.ImageFont")
    image = pil.new("RGB", (900, 160), "white")
    draw.Draw(image).text((20, 40), "WATER POINTS 2024", fill="black", font=font_mod.load_default(size=48))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    result = ocr.ocr_image(buffer.getvalue())
    assert "WATER" in result.text.upper()
    assert "2024" in result.text
