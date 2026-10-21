from fastapi.testclient import TestClient


def test_list_is_empty_initially(client: TestClient) -> None:
    response = client.get("/api/pantry-items")

    assert response.status_code == 200
    assert response.json() == []


def test_create_then_list_round_trips(client: TestClient) -> None:
    created = client.post(
        "/api/pantry-items", json={"name": "  Rice ", "quantity": 2, "unit": "kg"}
    )

    assert created.status_code == 201
    body = created.json()
    assert body["id"] > 0
    assert body["name"] == "Rice"
    assert body["quantity"] == 2
    assert body["unit"] == "kg"
    assert body["created_at"]

    listed = client.get("/api/pantry-items").json()
    assert [item["id"] for item in listed] == [body["id"]]


def test_create_rejects_non_positive_quantity(client: TestClient) -> None:
    response = client.post("/api/pantry-items", json={"name": "Rice", "quantity": 0})

    assert response.status_code == 422


def test_create_rejects_blank_name(client: TestClient) -> None:
    response = client.post("/api/pantry-items", json={"name": "   ", "quantity": 1})

    assert response.status_code == 422
