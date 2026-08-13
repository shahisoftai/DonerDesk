"""Activity narrative polishing stub for the DonorDesk workers."""
from __future__ import annotations

from pydantic import BaseModel


class PolishRequest(BaseModel):
    rough_summary: str
    achievements: str = ""
    challenges: str = ""
    lessons_learned: str = ""


def polish(req: PolishRequest) -> dict[str, str]:
    sentences = [
        "During the reporting period, the team implemented the planned activities.",
        f"Field notes: {req.rough_summary[:300]}",
    ]
    if req.achievements:
        sentences.append(f"Key achievements include: {req.achievements[:200]}.")
    if req.challenges:
        sentences.append(f"Challenges encountered: {req.challenges[:200]}.")
    if req.lessons_learned:
        sentences.append(f"Lessons learned: {req.lessons_learned[:200]}.")
    return {"narrative": " ".join(sentences), "model": "stub-v1"}
