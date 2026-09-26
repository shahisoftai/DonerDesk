"""Thin wrapper around docxtpl — renders a "templated" DOCX (placeholders
already physically inserted by `placeholder_inserter.insert_placeholders`)
against a context of {placeholderKey: content}."""
from __future__ import annotations

from io import BytesIO

from docxtpl import DocxTemplate


def render(templated_docx_bytes: bytes, context: dict[str, str]) -> bytes:
    tpl = DocxTemplate(BytesIO(templated_docx_bytes))
    tpl.render(context)
    buf = BytesIO()
    tpl.save(buf)
    return buf.getvalue()
