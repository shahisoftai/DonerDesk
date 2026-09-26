"""Deterministic donor-voice (language craft) signals.

The writer contract's language-craft rules were prompt-only: nothing measured
whether a draft actually reads like a donor report. These checks are cheap,
deterministic heuristics — they produce *warnings* (fed back to the writer on a
retry and recorded in telemetry), never hard failures, because a heuristic must
not be allowed to discard a factually correct section.

Mirrored in TypeScript at `packages/infrastructure/src/ai/donor-voice.ts`
(used by the golden-corpus evaluator).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")
_PASSIVE_RE = re.compile(
    r"\b(?:was|were|is|are|been|being|be)\s+(?:\w+ly\s+)?"
    r"(?:\w+ed|built|done|made|given|held|taken|seen|shown|written|known|found|brought|taught|met|paid|sent|spent|won|run|led)\b",
    re.IGNORECASE,
)
_TOPIC_LABEL_OPENING_RE = re.compile(
    r"^\s*(?:regarding|in terms of|with regards? to|as regards|as for|concerning|this section|the following section|in this section)\b",
    re.IGNORECASE,
)
FILLER_PHRASES: tuple[str, ...] = (
    "it is worth noting",
    "it should be noted",
    "it is important to note",
    "needless to say",
    "in order to",
    "at the end of the day",
)
VAGUE_QUANTIFIERS: tuple[str, ...] = ("a number of", "numerous", "various", "many people", "several beneficiaries")

LONG_SENTENCE_WORDS = 35
PASSIVE_RATIO_WARN = 0.35
LONG_RATIO_WARN = 0.2


@dataclass(frozen=True)
class DonorVoiceReport:
    score: float
    warnings: tuple[str, ...]


def _sentences(text: str) -> list[str]:
    # Tables and list lines are structure, not prose.
    prose = "\n".join(line for line in text.splitlines() if not line.lstrip().startswith(("|", "-", "*", "#")))
    return [s.strip() for s in _SENTENCE_SPLIT_RE.split(prose.replace("\n", " ")) if s.strip()]


def assess(text: str) -> DonorVoiceReport:
    sentences = _sentences(text or "")
    if not sentences:
        return DonorVoiceReport(score=1.0, warnings=())
    lower = (text or "").lower()
    warnings: list[str] = []
    penalty = 0.0

    passive = sum(1 for s in sentences if _PASSIVE_RE.search(s))
    passive_ratio = passive / len(sentences)
    if passive_ratio > PASSIVE_RATIO_WARN:
        warnings.append(f"VOICE_PASSIVE: {passive}/{len(sentences)} sentences are passive; name the actor in the active voice")
        penalty += min(0.3, passive_ratio - PASSIVE_RATIO_WARN)

    long_sents = [s for s in sentences if len(s.split()) > LONG_SENTENCE_WORDS]
    if len(long_sents) / len(sentences) > LONG_RATIO_WARN:
        warnings.append(f"VOICE_LONG_SENTENCES: {len(long_sents)} sentences exceed {LONG_SENTENCE_WORDS} words; split them")
        penalty += 0.15

    if _TOPIC_LABEL_OPENING_RE.search(sentences[0]):
        warnings.append("VOICE_TOPIC_OPENING: open with the result, not a topic label")
        penalty += 0.15

    fillers = [p for p in FILLER_PHRASES if p in lower]
    if fillers:
        warnings.append(f"VOICE_FILLER: remove filler ({', '.join(fillers)})")
        penalty += 0.05 * len(fillers)

    vague = [p for p in VAGUE_QUANTIFIERS if p in lower]
    if vague:
        warnings.append(f"VOICE_VAGUE: replace vague quantifiers with recorded figures or remove them ({', '.join(vague)})")
        penalty += 0.05 * len(vague)

    return DonorVoiceReport(score=max(0.0, round(1.0 - penalty, 3)), warnings=tuple(warnings))
