"""Deterministic clean-up of the writer's prose before validation.

Two things the model keeps doing despite the contract (demo 7): it narrates the tool's own bookkeeping ("every finding
carries a neutral evaluation, so the report records no performance judgement") and it echoes the donor's mandatory
question as a heading. Neither belongs in donor text, so both are removed here rather than asked for again.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

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


_WORD = re.compile(r"[A-Za-z][A-Za-z'’-]*")
_MIN_NAME_WORDS = 3
_NEAR_NAME = 0.86


def restore_proper_names(content: str, names: list[str]) -> str:
    """Puts a mangled donor, organisation or project name back to exactly as given
    ("Resilient Fund" -> "Resilience Fund").

    The model sometimes re-spells a long name by one word. A name of at least three words is looked for in the text as a
    run of the same number of words that is *almost* the name (same first word, similarity >= 0.86) and replaced by the
    exact name. Names shorter than three words are left alone: a near match on two words is too often a different thing.
    """
    text = content or ""
    for name in sorted({n.strip() for n in names if n and n.strip()}, key=len, reverse=True):
        name_words = _WORD.findall(name)
        count = len(name_words)
        if count < _MIN_NAME_WORDS:
            continue
        lowered = name.lower()
        spans = [m.span() for m in _WORD.finditer(text)]
        replacements: list[tuple[int, int]] = []
        i = 0
        while i + count <= len(spans):
            start, end = spans[i][0], spans[i + count - 1][1]
            window = text[start:end]
            # the run must be plain words separated by single spaces, so it is a phrase and not words from two sentences
            if (
                re.fullmatch(r"[^\s]+(?: [^\s]+)*", window)
                and window != name
                and window.lower().split()[0] == lowered.split()[0]
                and SequenceMatcher(None, window.lower(), lowered).ratio() >= _NEAR_NAME
            ):
                replacements.append((start, end))
                i += count
            else:
                i += 1
        for start, end in reversed(replacements):
            text = text[:start] + name + text[end:]
    return text


def scrub_section(section: GeneratedSection, req: SectionDraftRequest) -> GeneratedSection:
    cleaned = scrub_content(section.content, list(req.section.mandatoryQuestions or []))
    project = req.context.project if req.context else None
    names = (
        [
            n
            for n in (project.donorName, project.implementingOrganization, project.partnerOrganization, project.title)
            if n
        ]
        if project
        else []
    )
    cleaned = restore_proper_names(cleaned, names)
    return section if cleaned == section.content else section.model_copy(update={"content": cleaned})


def _count(text: str) -> int:
    return len(
        [
            w
            for w in re.split(
                r"\s+",
                "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("|")).strip(),
            )
            if w
        ]
    )


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
            candidate = sentences[:si] + sentences[si + 1 :]
            lines[li] = " ".join(candidate)
            sentences = candidate
            if _count("\n".join(lines)) <= max_words:
                return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
        if not lines[li].strip():
            lines[li] = ""
    return content
