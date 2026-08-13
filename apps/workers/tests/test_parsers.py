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
