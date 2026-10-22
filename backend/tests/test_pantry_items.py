from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import ingredient_id


def test_add_by_ingredient_id_estimates_expiry(
    auth_client: TestClient, db_session: Session
) -> None:
    milk = ingredient_id(db_session, "milk")
    bought = date.today() - timedelta(days=1)

    response = auth_client.post(
        "/api/pantry",
        json={"ingredient_id": milk, "quantity": 1, "storage": "fridge",
              "purchased_on": bought.isoformat()},
    )  # fmt: skip

    assert response.status_code == 201
    body = response.json()
    assert body["ingredient"]["canonical_name"] == "milk"
    assert body["unit"] == "gallon"  # ingredient default
    assert body["expires_on"] == (bought + timedelta(days=7)).isoformat()
    assert body["expiry_estimated"] is True


def test_add_by_free_text_resolves_alias(auth_client: TestClient) -> None:
    body = auth_client.post("/api/pantry", json={"name": "Scallions"}).json()

    assert body["ingredient"]["canonical_name"] == "green onion"
    assert body["quantity"] is None  # "have some"
    assert body["unit"] is None


def test_unknown_text_creates_new_ingredient(auth_client: TestClient) -> None:
    body = auth_client.post("/api/pantry", json={"name": "Dragonfruit"}).json()

    assert body["ingredient"]["canonical_name"] == "dragonfruit"
    assert body["ingredient"]["category"] == "other"
    assert body["expires_on"] is None


def test_storage_changes_estimate(auth_client: TestClient) -> None:
    item = auth_client.post(
        "/api/pantry", json={"name": "chicken breast", "quantity": 1, "storage": "fridge"}
    ).json()

    frozen = auth_client.patch(f"/api/pantry/{item['id']}", json={"storage": "freezer"}).json()

    assert frozen["expires_on"] == (date.today() + timedelta(days=270)).isoformat()


def test_override_and_reset_expiry(auth_client: TestClient) -> None:
    item = auth_client.post("/api/pantry", json={"name": "spinach", "storage": "fridge"}).json()
    override = (date.today() + timedelta(days=10)).isoformat()

    patched = auth_client.patch(f"/api/pantry/{item['id']}", json={"expires_on": override}).json()
    assert patched["expires_on"] == override
    assert patched["expiry_estimated"] is False

    reset = auth_client.patch(f"/api/pantry/{item['id']}", json={"use_estimate": True}).json()
    assert reset["expires_on"] == item["expires_on"]
    assert reset["expiry_estimated"] is True


def test_list_orders_by_expiry_and_hides_discarded(auth_client: TestClient) -> None:
    later = auth_client.post("/api/pantry", json={"name": "rice"}).json()
    sooner = auth_client.post("/api/pantry", json={"name": "spinach", "storage": "fridge"}).json()
    gone = auth_client.post("/api/pantry", json={"name": "milk", "storage": "fridge"}).json()

    assert auth_client.delete(f"/api/pantry/{gone['id']}").status_code == 204

    ids = [item["id"] for item in auth_client.get("/api/pantry").json()]
    assert ids == [sooner["id"], later["id"]]


def test_create_validates(auth_client: TestClient) -> None:
    assert auth_client.post("/api/pantry", json={}).status_code == 422
    assert auth_client.post("/api/pantry", json={"name": "rice", "quantity": 0}).status_code == 422
    assert (
        auth_client.post("/api/pantry", json={"name": "rice", "storage": "garage"}).status_code
        == 422
    )


def test_autocomplete(auth_client: TestClient) -> None:
    names = [i["canonical_name"] for i in auth_client.get("/api/ingredients?q=chick").json()]
    assert names[:3] == ["chicken breast", "chicken broth", "chicken thigh"]
    assert "chickpeas" in names

    fuzzy = auth_client.get("/api/ingredients?q=brocoli").json()
    assert fuzzy[0]["canonical_name"] == "broccoli"
