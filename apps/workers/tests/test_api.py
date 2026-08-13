AUTH = {"x-internal-token": "test-internal-token"}


def test_health_is_public(client) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_ready_is_public(client) -> None:
    res = client.get("/ready")
    assert res.status_code == 200
    assert res.json()["status"] == "ready"


def test_v1_rejects_missing_token(client) -> None:
    res = client.post("/v1/suggest-tags", json={"file_name": "a", "file_type": "text/plain"})
    assert res.status_code == 401


def test_v1_rejects_wrong_token(client) -> None:
    res = client.post(
        "/v1/suggest-tags",
        json={"file_name": "a", "file_type": "text/plain"},
        headers={"x-internal-token": "nope"},
    )
    assert res.status_code == 401


def test_v1_suggest_tags_with_token(client) -> None:
    res = client.post(
        "/v1/suggest-tags",
        json={"file_name": "photo.jpg", "file_type": "image/jpeg", "extracted_text": "photo evidence"},
        headers=AUTH,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["model"] == "stub-v1"
    assert body["tags"][0]["value"] == "PHOTO"


def test_v1_parse_with_token(client) -> None:
    res = client.post(
        "/v1/parse",
        files={"file": ("notes.txt", b"hello world", "text/plain")},
        headers=AUTH,
    )
    assert res.status_code == 200
    assert res.json()["text"] == "hello world"


def test_v1_polish_with_token(client) -> None:
    res = client.post("/v1/polish", json={"rough_summary": "good progress"}, headers=AUTH)
    assert res.status_code == 200
    assert res.json()["model"] == "stub-v1"
