import os

import pytest
from fastapi import HTTPException

from app.security import INTERNAL_TOKEN_HEADER, require_internal_token


class _FakeRequest:
    def __init__(self, headers: dict[str, str]) -> None:
        self.headers = headers


def test_accepts_valid_token() -> None:
    os.environ["INTERNAL_TOKEN"] = "secret-token"
    req = _FakeRequest({INTERNAL_TOKEN_HEADER: "secret-token"})
    assert require_internal_token(req) is None


def test_rejects_missing_token() -> None:
    os.environ["INTERNAL_TOKEN"] = "secret-token"
    req = _FakeRequest({})
    with pytest.raises(HTTPException) as exc:
        require_internal_token(req)
    assert exc.value.status_code == 401


def test_rejects_wrong_token() -> None:
    os.environ["INTERNAL_TOKEN"] = "secret-token"
    req = _FakeRequest({INTERNAL_TOKEN_HEADER: "wrong"})
    with pytest.raises(HTTPException) as exc:
        require_internal_token(req)
    assert exc.value.status_code == 401


def test_fails_closed_when_not_configured(monkeypatch) -> None:
    monkeypatch.delenv("INTERNAL_TOKEN", raising=False)
    req = _FakeRequest({INTERNAL_TOKEN_HEADER: "any"})
    with pytest.raises(HTTPException) as exc:
        require_internal_token(req)
    assert exc.value.status_code == 500
