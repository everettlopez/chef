from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Ingredient
from app.services.pantry_items import estimate_expiry
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


def test_punctuation_only_name_is_rejected(auth_client: TestClient) -> None:
    for _ in range(2):  # the second attempt used to hit a unique-constraint 500
        assert auth_client.post("/api/pantry", json={"name": "!!!"}).status_code == 422


def test_autocomplete_treats_wildcards_literally(auth_client: TestClient) -> None:
    assert auth_client.get("/api/ingredients?q=_").json() == []


@pytest.mark.parametrize(("storage", "days"), [("pantry", 1), ("fridge", 7), ("freezer", 90)])
def test_estimate_expiry_per_storage(storage: str, days: int) -> None:
    milk = Ingredient(
        canonical_name="milk", shelf_days_pantry=1, shelf_days_fridge=7, shelf_days_freezer=90
    )
    bought = date(2026, 3, 1)
    assert estimate_expiry(milk, storage, bought) == bought + timedelta(days=days)


def test_estimate_expiry_without_shelf_data() -> None:
    mystery = Ingredient(canonical_name="mystery", shelf_days_fridge=5)
    assert estimate_expiry(mystery, "pantry", date(2026, 3, 1)) is None


def test_unknown_ids_are_404(auth_client: TestClient) -> None:
    assert auth_client.post("/api/pantry", json={"ingredient_id": 999_999}).status_code == 404
    assert auth_client.patch("/api/pantry/999999", json={"quantity": 1}).status_code == 404
    assert auth_client.delete("/api/pantry/999999").status_code == 404


def test_explicit_unit_is_normalized(auth_client: TestClient) -> None:
    body = auth_client.post("/api/pantry", json={"name": "rice", "quantity": 2, "unit": "Cups"})
    assert body.json()["unit"] == "cup"


def test_explicit_expiry_on_create_is_not_an_estimate(auth_client: TestClient) -> None:
    when = (date.today() + timedelta(days=5)).isoformat()
    body = auth_client.post("/api/pantry", json={"name": "rice", "expires_on": when}).json()

    assert body["expires_on"] == when
    assert body["expiry_estimated"] is False


def test_clearing_quantity_means_have_some(auth_client: TestClient) -> None:
    item = auth_client.post("/api/pantry", json={"name": "rice", "quantity": 2, "unit": "cup"})

    patched = auth_client.patch(
        f"/api/pantry/{item.json()['id']}", json={"quantity": None, "unit": None}
    ).json()

    assert (patched["quantity"], patched["unit"]) == (None, None)


def test_changing_purchase_date_moves_the_estimate(auth_client: TestClient) -> None:
    item = auth_client.post("/api/pantry", json={"name": "milk", "storage": "fridge"}).json()
    earlier = date.today() - timedelta(days=3)

    patched = auth_client.patch(
        f"/api/pantry/{item['id']}", json={"purchased_on": earlier.isoformat()}
    ).json()

    assert patched["expires_on"] == (earlier + timedelta(days=7)).isoformat()


def test_manual_override_survives_storage_change(auth_client: TestClient) -> None:
    item = auth_client.post("/api/pantry", json={"name": "milk", "storage": "fridge"}).json()
    override = (date.today() + timedelta(days=20)).isoformat()
    auth_client.patch(f"/api/pantry/{item['id']}", json={"expires_on": override})

    moved = auth_client.patch(f"/api/pantry/{item['id']}", json={"storage": "freezer"}).json()

    assert moved["expires_on"] == override


def test_marking_used_hides_the_item(auth_client: TestClient) -> None:
    item = auth_client.post("/api/pantry", json={"name": "rice"}).json()

    patched = auth_client.patch(f"/api/pantry/{item['id']}", json={"status": "used"})

    assert patched.json()["status"] == "used"
    assert auth_client.get("/api/pantry").json() == []


def test_update_validates(auth_client: TestClient) -> None:
    item = auth_client.post("/api/pantry", json={"name": "rice"}).json()
    url = f"/api/pantry/{item['id']}"

    assert auth_client.patch(url, json={"quantity": -1}).status_code == 422
    assert auth_client.patch(url, json={"storage": "garage"}).status_code == 422
    assert auth_client.patch(url, json={"status": "eaten"}).status_code == 422


def test_free_text_reuses_existing_ingredients(auth_client: TestClient) -> None:
    first = auth_client.post("/api/pantry", json={"name": "Dragonfruit"}).json()
    second = auth_client.post("/api/pantry", json={"name": "dragon fruit"}).json()
    third = auth_client.post("/api/pantry", json={"name": "dragonfruits"}).json()

    assert first["ingredient"]["id"] == third["ingredient"]["id"]
    # Fuzzy matching joins the spaced spelling to the user-created ingredient too.
    assert second["ingredient"]["id"] == first["ingredient"]["id"]


def test_autocomplete_requires_a_query(auth_client: TestClient) -> None:
    assert auth_client.get("/api/ingredients").status_code == 422
    assert len(auth_client.get("/api/ingredients?q=c&limit=3").json()) == 3
    assert auth_client.get("/api/ingredients?q=c&limit=21").status_code == 422
