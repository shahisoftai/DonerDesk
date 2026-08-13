import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

os.environ.setdefault("INTERNAL_TOKEN", "test-internal-token")


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as c:
        yield c
