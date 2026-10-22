from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.conftest import SignUp


def add(client: TestClient, name: str, quantity=None, unit=None, days=None) -> dict:
    body: dict = {"name": name, "quantity": quantity, "unit": unit}
    if days is not None:
        body["expires_on"] = (date.today() + timedelta(days=days)).isoformat()
    response = client.post("/api/pantry", json=body)
    assert response.status_code == 201
    return response.json()


def recipe_id(client: TestClient, query: str) -> int:
    return client.get("/api/recipes", params={"q": query}).json()[0]["id"]


def pantry(client: TestClient) -> dict[int, dict]:
    return {item["id"]: item for item in client.get("/api/pantry").json()}


def test_cooking_deducts_and_undo_restores(auth_client: TestClient) -> None:
    chicken = add(auth_client, "chicken breast", 1.5, "lb")
    rice = add(auth_client, "rice", 6, "cup")
    spinach = add(auth_client, "spinach", 4, "cup")
    garlic = add(auth_client, "garlic")  # "have some": left alone
    butter = add(auth_client, "butter", 16, "tbsp")
    lemon = add(auth_client, "lemon", 2)

    log = auth_client.post(
        "/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "garlic butter")}
    )
    assert log.status_code == 201
    assert log.json()["servings_made"] == 2
    assert log.json()["cooked_by"] == "Cook"

    after = pantry(auth_client)
    assert after[chicken["id"]]["quantity"] == 0.5
    assert after[rice["id"]]["quantity"] == 5
    assert after[spinach["id"]]["quantity"] == 2
    assert after[butter["id"]]["quantity"] == 14
    assert after[lemon["id"]]["quantity"] == 1
    assert after[garlic["id"]]["quantity"] is None

    history = auth_client.get("/api/cook-logs").json()
    assert [h["id"] for h in history] == [log.json()["id"]]

    assert auth_client.delete(f"/api/cook-logs/{log.json()['id']}").status_code == 204
    restored = pantry(auth_client)
    for item in (chicken, rice, spinach, butter, lemon):
        assert restored[item["id"]]["quantity"] == item["quantity"]
    assert auth_client.get("/api/cook-logs").json() == []


def test_oldest_expiring_batch_is_used_first(auth_client: TestClient) -> None:
    newer = add(auth_client, "chicken breast", 2, "lb", days=2)
    older = add(auth_client, "chicken breast", 0.5, "lb", days=1)

    auth_client.post("/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "garlic butter")})

    items = pantry(auth_client)
    assert older["id"] not in items  # fully used, so no longer active
    assert items[newer["id"]]["quantity"] == 1.5


def test_servings_scale_and_units_convert(auth_client: TestClient) -> None:
    chicken = add(auth_client, "chicken breast", 32, "oz")

    auth_client.post(
        "/api/cook-logs",
        json={"recipe_id": recipe_id(auth_client, "garlic butter"), "servings_made": 3},
    )

    # 1 lb per 2 servings -> 1.5 lb = 24 oz
    assert pantry(auth_client)[chicken["id"]]["quantity"] == 8


def test_incompatible_units_use_up_batch_and_undo_reactivates(auth_client: TestClient) -> None:
    spinach = add(auth_client, "spinach", 1, "bunch")

    log = auth_client.post(
        "/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "garlic butter")}
    ).json()
    assert spinach["id"] not in pantry(auth_client)
    assert log["usages"][0]["quantity_used"] is None

    auth_client.delete(f"/api/cook-logs/{log['id']}")
    assert pantry(auth_client)[spinach["id"]]["quantity"] == 1


def test_cook_logs_are_household_scoped(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    log = ana.post("/api/cook-logs", json={"recipe_id": recipe_id(ana, "omelette")}).json()

    assert ben.get("/api/cook-logs").json() == []
    assert ben.delete(f"/api/cook-logs/{log['id']}").status_code == 404
    assert ana.post("/api/cook-logs", json={"recipe_id": 999999}).status_code == 404
