"""Thin wrapper around docxtpl — renders a "templated" DOCX (placeholders
already physically inserted by `placeholder_inserter.insert_placeholders`)
against a context of {placeholderKey: content}.

Section content is markdown. Each placeholder that sits alone in its own
paragraph (how `insert_placeholders` writes them) is rendered as native Word
blocks — headings, lists, tables, bold/italic — via a docxtpl Subdoc, so the
donor's document never shows raw `**` or `|` markup. Any other placeholder
occurrence falls back to the plain text of the section."""
from __future__ import annotations

import re
from io import BytesIO
from typing import Any

from docxtpl import DocxTemplate

from .markdown_docx import markdown_to_subdoc, parse_markdown_blocks

_SOLO_PLACEHOLDER_RE = re.compile(r"^\s*\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}\s*$")


def _iter_paragraphs(document: Any) -> Any:
    yield from document.paragraphs
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                yield from cell.paragraphs


def _plain_text(content: str) -> str:
    """Markdown → readable plain text for inline (non-paragraph) placeholders."""
    lines: list[str] = []
    for block in parse_markdown_blocks(content):
        if block.kind == "table":
            lines.append(" | ".join(block.header))
            lines.extend(" | ".join(row) for row in block.rows)
        else:
            text = "".join(run.text for run in block.inline)
            lines.append(f"{block.marker} {text}" if block.kind == "bullet" else text)
    return "\n".join(lines)


def render(templated_docx_bytes: bytes, context: dict[str, str]) -> bytes:
    tpl = DocxTemplate(BytesIO(templated_docx_bytes))
    document = tpl.get_docx()

    # Promote whole-paragraph `{{ key }}` tags to docxtpl's paragraph form
    # `{{p key }}` so a Subdoc can replace the paragraph with real blocks.
    block_keys: set[str] = set()
    for paragraph in _iter_paragraphs(document):
        match = _SOLO_PLACEHOLDER_RE.match(paragraph.text)
        if not match or match.group(1) not in context or not paragraph.runs:
            continue
        key = match.group(1)
        paragraph.runs[0].text = f"{{{{p {key} }}}}"
        for run in paragraph.runs[1:]:
            run.text = ""
        block_keys.add(key)

    rendered_context: dict[str, Any] = {}
    for key, content in context.items():
        rendered_context[key] = markdown_to_subdoc(tpl, content) if key in block_keys else _plain_text(content)

    tpl.render(rendered_context, autoescape=True)
    buf = BytesIO()
    tpl.save(buf)
    return buf.getvalue()
