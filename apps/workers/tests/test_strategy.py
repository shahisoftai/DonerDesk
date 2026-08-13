from app import _strategy_data as s


def test_strategy_data_loads() -> None:
    assert isinstance(s.EVIDENCE_KEYWORDS, list)
    assert len(s.EVIDENCE_KEYWORDS) == 17
    assert isinstance(s.SENSITIVE_KEYWORDS, list)
    assert s.SENSITIVE_KEYWORDS
    assert s.ACTIVITY_TITLE_MATCH_PREFIX == 6
    assert s.INDICATOR_NAME_MATCH_PREFIX == 8


def test_parse_routes_include_reference_handlers() -> None:
    handlers = {str(r["handler"]) for r in s.PARSE_ROUTES}
    assert "docx" in handlers
    assert "pdf" in handlers
    assert "filename" in handlers
