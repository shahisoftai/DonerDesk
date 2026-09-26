"""Tests for donor-template rendering (docxtpl) — placeholder insertion,
rendering, and the FastAPI routes. Runs without an LLM."""
from __future__ import annotations

import base64
from io import BytesIO

from docx import Document

from app.donor_template.models import RegionRef
from app.donor_template.placeholder_inserter import insert_placeholders
from app.donor_template.renderer import render

AUTH = {"x-internal-token": "test-internal-token"}


def _fixture_docx() -> bytes:
    doc = Document()
    doc.add_paragraph("Donor Report Template", style="Title")
    doc.add_paragraph("1. Executive Summary", style="Heading 1")
    doc.add_paragraph("placeholder body text")
    doc.add_paragraph("2. Indicator Performance", style="Heading 1")
    table = doc.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "Code"
    table.rows[0].cells[1].text = "Value"
    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()


# --------------------------------------------------------------------------- #
# placeholder_inserter — pure, no FastAPI
# --------------------------------------------------------------------------- #


def test_insert_placeholders_inserts_tag_before_mapped_heading() -> None:
    original = _fixture_docx()
    regions = [RegionRef(id="h-0001", kind="HEADING", order=1, placeholderKey="region_h_0001")]
    templated = insert_placeholders(original, regions)
    doc = Document(BytesIO(templated))
    texts = [p.text for p in doc.paragraphs]
    assert "{{ region_h_0001 }}" in texts
    idx = texts.index("{{ region_h_0001 }}")
    assert texts[idx + 1] == "1. Executive Summary"


def test_insert_placeholders_inserts_tag_before_mapped_table() -> None:
    original = _fixture_docx()
    regions = [RegionRef(id="t-0000", kind="TABLE", order=2, placeholderKey="region_t_0000")]
    templated = insert_placeholders(original, regions)
    doc = Document(BytesIO(templated))
    assert len(doc.tables) == 1, "the table itself must not be duplicated or removed"
    texts = [p.text for p in doc.paragraphs]
    assert "{{ region_t_0000 }}" in texts


def test_insert_placeholders_ignores_regions_not_supplied() -> None:
    original = _fixture_docx()
    templated = insert_placeholders(original, [])
    doc = Document(BytesIO(templated))
    texts = [p.text for p in doc.paragraphs]
    assert not any(t.startswith("{{") for t in texts), "no placeholder should be inserted when no region is mapped"


def test_insert_placeholders_uses_title_style_as_heading_index_zero() -> None:
    """The TS mammoth parser maps Word's Title style to h1 in the same
    position; the Python side must count it the same way so region ids
    computed by one side locate the right block via the other."""
    original = _fixture_docx()
    regions = [RegionRef(id="h-0000", kind="HEADING", order=0, placeholderKey="region_h_0000")]
    templated = insert_placeholders(original, regions)
    doc = Document(BytesIO(templated))
    texts = [p.text for p in doc.paragraphs]
    idx = texts.index("{{ region_h_0000 }}")
    assert texts[idx + 1] == "Donor Report Template"


# --------------------------------------------------------------------------- #
# renderer — pure, no FastAPI
# --------------------------------------------------------------------------- #


def test_render_substitutes_placeholder_with_content() -> None:
    original = _fixture_docx()
    templated = insert_placeholders(original, [RegionRef(id="h-0001", kind="HEADING", order=1, placeholderKey="region_h_0001")])
    rendered = render(templated, {"region_h_0001": "Real generated content for this section."})
    doc = Document(BytesIO(rendered))
    texts = [p.text for p in doc.paragraphs]
    assert "Real generated content for this section." in texts
    assert not any("{{" in t for t in texts), "no unrendered Jinja2 tags should remain"


# --------------------------------------------------------------------------- #
# HTTP routes
# --------------------------------------------------------------------------- #


def test_insert_placeholders_route_requires_token(client) -> None:
    res = client.post("/v1/donor-template/insert-placeholders", json={"originalDocxBase64": "", "regions": []})
    assert res.status_code == 401


def test_insert_placeholders_route_end_to_end(client) -> None:
    original = _fixture_docx()
    res = client.post(
        "/v1/donor-template/insert-placeholders",
        headers=AUTH,
        json={
            "originalDocxBase64": base64.b64encode(original).decode("ascii"),
            "regions": [{"id": "h-0001", "kind": "HEADING", "order": 1, "placeholderKey": "region_h_0001"}],
        },
    )
    assert res.status_code == 200
    templated_b64 = res.json()["templatedDocxBase64"]
    doc = Document(BytesIO(base64.b64decode(templated_b64)))
    assert "{{ region_h_0001 }}" in [p.text for p in doc.paragraphs]


def test_render_route_end_to_end(client) -> None:
    original = _fixture_docx()
    templated = insert_placeholders(original, [RegionRef(id="h-0001", kind="HEADING", order=1, placeholderKey="region_h_0001")])
    res = client.post(
        "/v1/donor-template/render",
        headers=AUTH,
        json={
            "templatedDocxBase64": base64.b64encode(templated).decode("ascii"),
            "context": {"region_h_0001": "Rendered via the HTTP route."},
        },
    )
    assert res.status_code == 200
    rendered_b64 = res.json()["renderedDocxBase64"]
    doc = Document(BytesIO(base64.b64decode(rendered_b64)))
    assert "Rendered via the HTTP route." in [p.text for p in doc.paragraphs]


def test_render_route_returns_422_on_malformed_input(client) -> None:
    res = client.post(
        "/v1/donor-template/render",
        headers=AUTH,
        json={"templatedDocxBase64": "not-valid-base64-docx", "context": {}},
    )
    assert res.status_code == 422
