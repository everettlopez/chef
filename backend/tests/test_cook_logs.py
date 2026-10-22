from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from tests.conftest import SignUp, join_household


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


def test_undo_keeps_a_batch_discarded_after_cooking(auth_client: TestClient) -> None:
    spinach = add(auth_client, "spinach", 4, "cup")
    log = auth_client.post(
        "/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "garlic butter")}
    ).json()
    auth_client.delete(f"/api/pantry/{spinach['id']}")  # it went bad after dinner

    auth_client.delete(f"/api/cook-logs/{log['id']}")

    assert spinach["id"] not in pantry(auth_client)


def test_amounts_too_small_for_the_batch_unit_are_skipped(auth_client: TestClient) -> None:
    # The omelette's 2 tbsp of milk is optional, so use cinnamon: 1/2 tsp from a cup.
    cinnamon = add(auth_client, "cinnamon", 1, "gallon")

    log = auth_client.post(
        "/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "oatmeal"), "servings_made": 1}
    ).json()

    assert pantry(auth_client)[cinnamon["id"]]["quantity"] == 1
    assert all(u["ingredient_name"] != "cinnamon" for u in log["usages"])


def test_undo_twice_is_404(auth_client: TestClient) -> None:
    log = auth_client.post(
        "/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "omelette")}
    ).json()

    assert auth_client.delete(f"/api/cook-logs/{log['id']}").status_code == 204
    assert auth_client.delete(f"/api/cook-logs/{log['id']}").status_code == 404
    assert auth_client.get("/api/cook-logs").json() == []


@pytest.mark.parametrize("servings", [0, -1, 51])
def test_servings_are_validated(auth_client: TestClient, servings: int) -> None:
    response = auth_client.post(
        "/api/cook-logs",
        json={"recipe_id": recipe_id(auth_client, "omelette"), "servings_made": servings},
    )
    assert response.status_code == 422


def test_servings_default_to_the_recipe(auth_client: TestClient) -> None:
    log = auth_client.post(
        "/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "garlic butter")}
    ).json()

    assert log["servings_made"] == 2
    assert log["recipe_title"] == "Garlic Butter Chicken with Spinach Rice"
    assert log["cooked_by"] == "Cook"


def test_cooking_with_an_empty_pantry_logs_no_usages(auth_client: TestClient) -> None:
    log = auth_client.post(
        "/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "omelette")}
    ).json()
    assert log["usages"] == []


def test_have_some_batches_are_left_alone(auth_client: TestClient) -> None:
    garlic = add(auth_client, "garlic")

    log = auth_client.post(
        "/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "garlic butter")}
    ).json()

    assert garlic["id"] in pantry(auth_client)
    assert all(u["ingredient_name"] != "garlic" for u in log["usages"])


def test_staples_and_optional_lines_are_not_deducted(auth_client: TestClient) -> None:
    salt = add(auth_client, "salt", 100, "g")
    milk = add(auth_client, "milk", 1, "cup")

    auth_client.post("/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "omelette")})

    items = pantry(auth_client)
    assert items[salt["id"]]["quantity"] == 100
    assert items[milk["id"]]["quantity"] == 1


def test_deduction_spans_batches_and_undo_restores_each(auth_client: TestClient) -> None:
    first = add(auth_client, "chicken breast", 0.25, "lb", days=1)
    second = add(auth_client, "chicken breast", 0.5, "lb", days=2)
    third = add(auth_client, "chicken breast", 2, "lb", days=5)

    log = auth_client.post(
        "/api/cook-logs", json={"recipe_id": recipe_id(auth_client, "garlic butter")}
    ).json()

    items = pantry(auth_client)
    assert first["id"] not in items and second["id"] not in items
    assert items[third["id"]]["quantity"] == 1.75
    chicken = [
        u["quantity_used"] for u in log["usages"] if u["ingredient_name"] == "chicken breast"
    ]
    assert sorted(chicken) == [0.25, 0.25, 0.5]

    auth_client.delete(f"/api/cook-logs/{log['id']}")
    items = pantry(auth_client)
    assert [items[i["id"]]["quantity"] for i in (first, second, third)] == [0.25, 0.5, 2]


def test_history_is_newest_first_and_shared(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    join_household(ben, ana)
    first = ana.post("/api/cook-logs", json={"recipe_id": recipe_id(ana, "omelette")}).json()
    second = ben.post("/api/cook-logs", json={"recipe_id": recipe_id(ben, "oatmeal")}).json()

    history = ana.get("/api/cook-logs").json()

    assert [h["id"] for h in history] == [second["id"], first["id"]]
    assert [h["cooked_by"] for h in history] == ["Ben", "Ana"]
    # Any member can undo a shared meal.
    assert ana.delete(f"/api/cook-logs/{second['id']}").status_code == 204


def test_a_cook_does_not_touch_other_households(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    bens_eggs = add(ben, "egg", 12)

    ana.post("/api/cook-logs", json={"recipe_id": recipe_id(ana, "omelette")})

    assert pantry(ben)[bens_eggs["id"]]["quantity"] == 12
