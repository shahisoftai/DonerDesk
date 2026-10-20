from app.parsers import parse, route_file


def test_route_text() -> None:
    assert route_file("notes.txt", "text/plain") == "text"


def test_route_csv_with_text_content_type_routes_to_text() -> None:
    # Mirrors the TypeScript parser: text/* content wins over the csv extension.
    assert route_file("data.csv", "text/csv") == "text"


def test_route_csv_with_binary_content_type() -> None:
    assert route_file("data.csv", "application/octet-stream") == "csv"


def test_route_pdf() -> None:
    assert route_file("report.pdf", "application/pdf") == "pdf"


def test_route_filename_fallback() -> None:
    assert route_file("image.png", "image/png") == "filename"


def test_parse_text() -> None:
    res = parse(b"hello world", "notes.txt", "text/plain")
    assert res["text"] == "hello world"
    assert res["filename"] == "notes.txt"
    assert res["size"] == 11


def test_parse_filename_fallback() -> None:
    res = parse(b"\x00\x01", "image.png", "image/png")
    assert res["text"] == "image.png"


def test_parse_reports_extracted_status() -> None:
    res = parse(b"hello world", "notes.txt", "text/plain")
    assert res["status"] == "EXTRACTED"
    assert "message" not in res


def test_parse_empty_text_is_reported_not_silent() -> None:
    res = parse(b"   \n", "blank.txt", "text/plain")
    assert res["status"] == "EMPTY"
    assert "blank.txt" in res["message"]
    assert "paste the text" in res["message"]


def test_parse_unreadable_pdf_is_reported_as_failed() -> None:
    res = parse(b"%PDF-not-really", "broken.pdf", "application/pdf")
    assert res["text"] == ""
    assert res["status"] == "FAILED"
    assert "broken.pdf" in res["message"]
    assert "Traceback" not in res["message"]


def test_parse_image_is_unsupported() -> None:
    res = parse(b"\x00\x01", "photo.png", "image/png")
    assert res["status"] == "UNSUPPORTED"


def test_upload_over_the_limit_is_refused(client, monkeypatch) -> None:
    import app.main as main

    monkeypatch.setattr(main, "MAX_PARSE_BYTES", 10)
    auth = {"x-internal-token": "test-internal-token"}
    big = client.post("/v1/parse", files={"file": ("big.txt", b"x" * 50, "text/plain")}, headers=auth)
    assert big.status_code == 413
    small = client.post("/v1/parse", files={"file": ("ok.txt", b"hello", "text/plain")}, headers=auth)
    assert small.status_code == 200
    assert small.json()["status"] == "EXTRACTED"


def test_corrupt_docx_is_reported_as_failed_without_the_library_error() -> None:
    docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    res = parse(b"this is not a zip file", "broken.docx", docx)
    assert res["text"] == ""
    assert res["status"] == "FAILED"
    assert "broken.docx" in res["message"]
    assert "zip" not in res["message"].lower() and "Traceback" not in res["message"]


def test_corrupt_xlsx_is_reported_as_failed() -> None:
    xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    res = parse(b"nope", "broken.xlsx", xlsx)
    assert res["status"] == "FAILED"


def test_template_render_failure_does_not_leak_the_exception(client) -> None:
    res = client.post(
        "/v1/donor-template/render",
        json={"templatedDocxBase64": "bm90IGEgZG9jeA==", "context": {}},
        headers={"x-internal-token": "test-internal-token"},
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "The donor template could not be filled in."
