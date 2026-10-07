"""Deterministic clean-up of the writer's prose before validation.

Two things the model keeps doing despite the contract (demo 7): it narrates the tool's own bookkeeping ("every finding
carries a neutral evaluation, so the report records no performance judgement") and it echoes the donor's mandatory
question as a heading. Neither belongs in donor text, so both are removed here rather than asked for again.
"""
from __future__ import annotations

import re

from .models import GeneratedSection, SectionDraftRequest

_BOOKKEEPING = re.compile(
    r"neutral evaluation|evaluation[^.]{0,30}\bneutral\b|performance judg(?:e)?ment|disaggregation list"
    r"|could not be calculated|not classified as not calculable|none was classified as not calculable"
    r"|no finding (?:was )?(?:flagged )?as not calculable",
    re.I,
)
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _norm(text: str) -> str:
    return re.sub(r"[\s*_>#-]+", " ", text).strip().lower()


def scrub_content(content: str, mandatory_questions: list[str]) -> str:
    questions = {_norm(q) for q in mandatory_questions if q and q.strip()}
    out: list[str] = []
    changed = False
    for line in (content or "").splitlines():
        stripped = line.strip()
        if stripped.startswith("|") or not stripped:
            out.append(line)
            continue
        # A donor question typed back as a heading or bold lead-in: drop the question, keep any answer after it.
        for q in sorted(questions, key=len, reverse=True):
            m = re.match(r"^[\s>#*_-]*" + re.escape(q).replace(r"\ ", r"[\s*_]+") + r"[\s*_]*(.*)$", stripped, re.I)
            if m:
                stripped = m.group(1).strip()
                changed = True
                break
        if not stripped:
            continue
        parts = _SENTENCE_SPLIT.split(stripped)
        kept = [s for s in parts if not _BOOKKEEPING.search(s)]
        changed = changed or len(kept) != len(parts)
        if kept:
            out.append(" ".join(kept))
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip() if changed else content


def scrub_section(section: GeneratedSection, req: SectionDraftRequest) -> GeneratedSection:
    cleaned = scrub_content(section.content, list(req.section.mandatoryQuestions or []))
    return section if cleaned == section.content else section.model_copy(update={"content": cleaned})


def _count(text: str) -> int:
    return len([w for w in re.split(r"\s+", "\n".join(l for l in text.splitlines() if not l.lstrip().startswith("|")).strip()) if w])


def trim_to_word_limit(content: str, max_words: int | None) -> str:
    """Last resort when the writer is still over a donor's word limit after its retry.

    Sentences that carry no figure are dropped from the end of the prose until the limit holds. A sentence with a
    number is a grounded fact and is never removed; if the limit cannot be met that way the text is returned unchanged.
    """
    if not max_words or _count(content) <= max_words:
        return content
    lines = content.splitlines()
    for li in range(len(lines) - 1, -1, -1):
        line = lines[li]
        if not line.strip() or line.lstrip().startswith("|"):
            continue
        sentences = _SENTENCE_SPLIT.split(line.strip())
        for si in range(len(sentences) - 1, -1, -1):
            if re.search(r"\d", sentences[si]):
                continue
            candidate = sentences[:si] + sentences[si + 1:]
            lines[li] = " ".join(candidate)
            sentences = candidate
            if _count("\n".join(lines)) <= max_words:
                return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
        if not lines[li].strip():
            lines[li] = ""
    return content
