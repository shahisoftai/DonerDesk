from app.polishing import PolishRequest, polish


def test_polish_builds_narrative() -> None:
    body = polish(PolishRequest(rough_summary="Field work done", achievements="Trained 10 people"))
    assert body["model"] == "stub-v1"
    assert "Field notes: Field work done" in body["narrative"]
    assert "Key achievements include: Trained 10 people." in body["narrative"]
