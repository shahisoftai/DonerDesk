from app.main import SuggestTagsRequest, health, suggest_tags


def test_health() -> None:
    assert health() == {"status": "ok", "service": "donordesk-workers"}


def test_tagging_records_model_and_detects_sensitive_data() -> None:
    body = suggest_tags(
        SuggestTagsRequest.model_validate(
            {
                "file_name": "beneficiary-list.csv",
                "file_type": "text/csv",
                "extracted_text": "Beneficiary name and phone",
            }
        )
    )
    assert body["model"] == "stub-v1"
    assert body["sensitivity_warning"] is not None
