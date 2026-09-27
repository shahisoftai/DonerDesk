"""Section markdown → native Word blocks for donor-template exports.

Report sections are stored as a small markdown subset (the same subset the
api's `exports/markdown-renderer.ts` renders for the built-in DOCX/PDF and the
report editor can produce): `###`/`####` headings, `-`/`1.` lists (nested by
indentation), `>` quotes, GFM pipe tables, `**bold**`, `*italic*`,
`` `code` `` and `[label](url)`.

Previously the donor-template path inserted the raw markdown string into the
placeholder, so the donor's document showed literal `**` and `|` characters.
This module parses the subset once and builds a docxtpl Subdoc that shares
the donor document's part — so headings, lists and tables pick up the donor's
own styles when they exist, and fall back to direct formatting when they
don't. The parser is total: unknown syntax degrades to a plain paragraph.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal

BlockKind = Literal["heading", "paragraph", "bullet", "quote", "table"]

_BULLET_RE = re.compile(r"^(\s*)[-*•]\s+(.*)$")
_ORDERED_RE = re.compile(r"^(\s*)(\d{1,2})[.)]\s+(.*)$")
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
_SEPARATOR_RE = re.compile(r"^\s*\|?\s*:?-{3,}")
# Emphasis must not start or end with whitespace (CommonMark flanking), so
# "2 * 3 * 4" stays literal — mirrors exports/markdown-renderer.ts.
_INLINE_RE = re.compile(
    r"\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*|\*(?!\s)([^*\n]+?)(?<!\s)\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\n]+)\)"
)


@dataclass
class InlineRun:
    text: str
    bold: bool = False
    italic: bool = False
    code: bool = False


@dataclass
class Block:
    kind: BlockKind
    inline: list[InlineRun] = field(default_factory=list)
    level: int = 0
    ordered: bool = False
    marker: str = ""
    header: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)


def parse_inline(text: str) -> list[InlineRun]:
    """**bold**, *italic*, `code`, [label](url) → runs; unmatched markers stay literal."""
    runs: list[InlineRun] = []
    cursor = 0
    for match in _INLINE_RE.finditer(text):
        if match.start() > cursor:
            runs.append(InlineRun(text[cursor : match.start()]))
        bold, italic, code, label, url = match.groups()
        if bold is not None:
            runs.append(InlineRun(bold, bold=True))
        elif italic is not None:
            runs.append(InlineRun(italic, italic=True))
        elif code is not None:
            runs.append(InlineRun(code, code=True))
        else:
            runs.append(InlineRun(f"{label} ({url})"))
        cursor = match.end()
    if cursor < len(text):
        runs.append(InlineRun(text[cursor:]))
    return [r for r in runs if r.text]


def _cells(line: str) -> list[str]:
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [c.strip() for c in stripped.split("|")]


def parse_markdown_blocks(content: str) -> list[Block]:
    """Splits section markdown into typed blocks. Never raises."""
    lines = (content or "").replace("\r\n", "\n").split("\n")
    blocks: list[Block] = []
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            blocks.append(Block("paragraph", parse_inline(" ".join(s.strip() for s in paragraph))))
            paragraph.clear()

    i = 0
    while i < len(lines):
        line = lines[i]
        trimmed = line.strip()
        if not trimmed:
            flush()
            i += 1
            continue
        heading = _HEADING_RE.match(trimmed)
        if heading:
            flush()
            blocks.append(Block("heading", parse_inline(heading.group(2).strip()), level=len(heading.group(1))))
            i += 1
            continue
        if trimmed.startswith("|") and i + 1 < len(lines) and _SEPARATOR_RE.match(lines[i + 1]):
            flush()
            header = _cells(line)
            rows: list[list[str]] = []
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(_cells(lines[i]))
                i += 1
            blocks.append(Block("table", header=header, rows=rows))
            continue
        bullet = _BULLET_RE.match(line)
        ordered = _ORDERED_RE.match(line)
        if bullet or ordered:
            flush()
            if bullet:
                indent, body, marker, is_ordered = bullet.group(1), bullet.group(2), "•", False
            else:
                assert ordered is not None
                indent, body, marker, is_ordered = ordered.group(1), ordered.group(3), f"{ordered.group(2)}.", True
            level = min(len(indent.replace("\t", "  ")) // 2, 2)
            blocks.append(Block("bullet", parse_inline(body.strip()), level=level, ordered=is_ordered, marker=marker))
            i += 1
            continue
        if trimmed.startswith(">"):
            flush()
            blocks.append(Block("quote", parse_inline(trimmed.lstrip(">").strip())))
            i += 1
            continue
        paragraph.append(line)
        i += 1
    flush()
    return blocks


# --------------------------------------------------------------------------- #
# Rendering into a docxtpl Subdoc
# --------------------------------------------------------------------------- #


def _style_exists(document: Any, name: str) -> bool:
    try:
        document.styles[name]
        return True
    except KeyError:
        return False


def _add_runs(paragraph: Any, inline: list[InlineRun], *, bold_all: bool = False, italic_all: bool = False) -> None:
    for run_spec in inline:
        run = paragraph.add_run(run_spec.text)
        if run_spec.bold or bold_all:
            run.bold = True
        if run_spec.italic or italic_all:
            run.italic = True
        if run_spec.code:
            run.font.name = "Consolas"


def markdown_to_subdoc(tpl: Any, content: str) -> Any:
    """Builds a docxtpl Subdoc for one section's markdown."""
    subdoc = tpl.new_subdoc()
    document = tpl.get_docx()
    for block in parse_markdown_blocks(content):
        if block.kind == "heading":
            # Section headings stay the donor's own; headings inside a section
            # map to Heading 3/4 when the template defines them.
            style = "Heading 3" if block.level <= 3 else "Heading 4"
            if _style_exists(document, style):
                _add_runs(subdoc.add_paragraph(style=style), block.inline)
            else:
                _add_runs(subdoc.add_paragraph(), block.inline, bold_all=True)
        elif block.kind == "bullet":
            base = "List Number" if block.ordered else "List Bullet"
            style = base if block.level == 0 else f"{base} {block.level + 1}"
            if _style_exists(document, style):
                _add_runs(subdoc.add_paragraph(style=style), block.inline)
            else:
                paragraph = subdoc.add_paragraph()
                paragraph.add_run(f"{'    ' * block.level}{block.marker} ")
                _add_runs(paragraph, block.inline)
        elif block.kind == "quote":
            if _style_exists(document, "Quote"):
                _add_runs(subdoc.add_paragraph(style="Quote"), block.inline)
            else:
                _add_runs(subdoc.add_paragraph(), block.inline, italic_all=True)
        elif block.kind == "table":
            columns = max([len(block.header), *(len(r) for r in block.rows)] or [1])
            table = subdoc.add_table(rows=1 + len(block.rows), cols=columns)
            if _style_exists(document, "Table Grid"):
                table.style = "Table Grid"
            for c in range(columns):
                cell = table.rows[0].cells[c]
                _add_runs(cell.paragraphs[0], parse_inline(block.header[c] if c < len(block.header) else ""), bold_all=True)
            for r, row in enumerate(block.rows, start=1):
                for c in range(columns):
                    cell = table.rows[r].cells[c]
                    _add_runs(cell.paragraphs[0], parse_inline(row[c] if c < len(row) else ""))
        else:
            _add_runs(subdoc.add_paragraph(), block.inline)
    return subdoc
