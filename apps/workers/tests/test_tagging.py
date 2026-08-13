from app.tagging import SuggestTagsRequest, suggest_tags


def test_suggests_evidence_type_and_sensitivity() -> None:
    body = suggest_tags(
        SuggestTagsRequest(
            file_name="beneficiary-list.csv",
            file_type="text/csv",
            extracted_text="Beneficiary name and phone",
        )
    )
    assert body["model"] == "stub-v1"
    assert body["sensitivityWarning"] is not None
    assert body["tags"][0]["field"] == "evidenceType"
    assert body["tags"][0]["value"] == "BENEFICIARY_LIST"


def test_defaults_to_other_when_no_keyword_matches() -> None:
    body = suggest_tags(
        SuggestTagsRequest(file_name="random.txt", file_type="text/plain", extracted_text="nothing relevant")
    )
    assert body["tags"][0]["value"] == "OTHER"
    assert body["tags"][0]["confidence"] == "LOW"
    assert body["sensitivityWarning"] is None


def test_matches_activity_and_indicator() -> None:
    body = suggest_tags(
        SuggestTagsRequest(
            file_name="report.pdf",
            file_type="application/pdf",
            extracted_text="training was delivered",
            existing_activities=[{"id": "a1", "title": "TRAINING WORKSHOP"}],
            existing_indicators=[{"id": "i1", "code": "TRAIN", "name": "Trained individuals"}],
        )
    )
    kinds = {(t["field"], t["value"]) for t in body["tags"]}
    assert ("activityId", "a1") in kinds
    assert ("indicatorId", "i1") in kinds
