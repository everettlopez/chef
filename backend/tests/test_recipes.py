from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.services.recipes import URGENT_DAYS
from tests.conftest import SignUp, join_household

GARLIC_CHICKEN = "Garlic Butter Chicken with Spinach Rice"


def stock(client: TestClient, *names: str, expires_in: dict[str, int] | None = None) -> None:
    for name in names:
        body: dict = {"name": name}
        if expires_in and name in expires_in:
            body["expires_on"] = (date.today() + timedelta(days=expires_in[name])).isoformat()
        assert client.post("/api/pantry", json=body).status_code == 201


def recommendations(client: TestClient, **params) -> list[dict]:
    response = client.get("/api/recipes/recommendations", params=params)
    assert response.status_code == 200
    return response.json()


def tag_id(client: TestClient, name: str) -> int:
    return next(t["id"] for t in client.get("/api/dietary-tags").json() if t["name"] == name)


def test_list_and_search(auth_client: TestClient) -> None:
    everything = auth_client.get("/api/recipes", params={"limit": 100}).json()
    assert len(everything) == 40

    by_title = auth_client.get("/api/recipes", params={"q": "taco"}).json()
    assert {r["title"] for r in by_title} >= {"Weeknight Beef Tacos"}

    by_ingredient = auth_client.get("/api/recipes", params={"q": "chickpeas"}).json()
    assert [r["title"] for r in by_ingredient] == ["Chickpea & Spinach Curry"]

    vegan = auth_client.get("/api/recipes", params={"tag_id": tag_id(auth_client, "vegan")}).json()
    assert vegan and all("vegan" in [t["name"] for t in r["tags"]] for r in vegan)


def test_detail_marks_pantry_and_staples(auth_client: TestClient) -> None:
    stock(auth_client, "chicken breast", "rice")
    recipe_id = next(
        r["id"] for r in auth_client.get("/api/recipes", params={"q": "garlic butter"}).json()
    )

    detail = auth_client.get(f"/api/recipes/{recipe_id}").json()
    by_name = {line["ingredient_name"]: line for line in detail["ingredients"]}
    assert by_name["chicken breast"]["in_pantry"] is True
    assert by_name["spinach"]["in_pantry"] is False
    assert by_name["salt"]["staple"] is True
    assert detail["instructions"].count("\n") >= 3

    assert auth_client.get("/api/recipes/999999").status_code == 404


def test_full_coverage_ranks_first(auth_client: TestClient) -> None:
    stock(auth_client, "chicken breast", "rice", "spinach", "garlic", "butter", "lemon")

    top = recommendations(auth_client)[0]

    assert top["recipe"]["title"] == GARLIC_CHICKEN
    assert top["coverage"] == 1.0
    assert top["required_count"] == 6  # water, salt and pepper don't count
    assert top["missing"] == []


def test_expiring_ingredients_raise_score(auth_client: TestClient) -> None:
    stock(auth_client, "egg", "spinach", "cheddar cheese", "butter")
    fresh = next(
        r
        for r in recommendations(auth_client)
        if r["recipe"]["title"] == "Spinach & Cheddar Omelette"
    )
    assert fresh["score"] == 0.7  # full coverage, nothing expiring
    assert fresh["expiring"] == []

    spinach = next(
        i
        for i in auth_client.get("/api/pantry").json()
        if i["ingredient"]["canonical_name"] == "spinach"
    )
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    auth_client.patch(f"/api/pantry/{spinach['id']}", json={"expires_on": tomorrow})

    urgent = next(
        r
        for r in recommendations(auth_client)
        if r["recipe"]["title"] == "Spinach & Cheddar Omelette"
    )
    assert urgent["score"] == 0.775  # 0.7 * 4/4 + 0.3 * 1/4
    assert urgent["expiring"] == ["spinach"]


def test_max_missing_filter(auth_client: TestClient) -> None:
    stock(auth_client, "chicken breast", "rice", "spinach", "garlic", "butter")

    exact = recommendations(auth_client, max_missing=0)
    one_short = recommendations(auth_client, max_missing=1)

    assert all(r["missing"] == [] for r in exact)
    assert GARLIC_CHICKEN not in [r["recipe"]["title"] for r in exact]
    chicken = next(r for r in one_short if r["recipe"]["title"] == GARLIC_CHICKEN)
    assert chicken["missing"] == ["lemon"]


def test_diet_preferences_filter_recommendations(auth_client: TestClient) -> None:
    stock(auth_client, "chicken breast", "rice", "spinach", "garlic", "butter", "lemon",
          "peanut butter", "pasta", "soy sauce")  # fmt: skip
    vegetarian = tag_id(auth_client, "vegetarian")
    nuts = tag_id(auth_client, "contains-nuts")

    saved = auth_client.put(
        "/api/me/diet-prefs",
        json={"prefs": [{"tag_id": vegetarian, "mode": "require"},
                        {"tag_id": nuts, "mode": "avoid"}]},
    )  # fmt: skip
    assert saved.status_code == 200
    assert {p["tag"]["name"] for p in auth_client.get("/api/me/diet-prefs").json()} == {
        "vegetarian",
        "contains-nuts",
    }

    results = recommendations(auth_client)
    assert results  # e.g. Spaghetti Pomodoro and the omelette still qualify
    for rec in results:
        tags = {t["name"] for t in rec["recipe"]["tags"]}
        assert "vegetarian" in tags
        assert "contains-nuts" not in tags


def test_unknown_diet_tag_is_404(auth_client: TestClient) -> None:
    response = auth_client.put(
        "/api/me/diet-prefs", json={"prefs": [{"tag_id": 999999, "mode": "avoid"}]}
    )
    assert response.status_code == 404


def test_empty_pantry_has_no_recommendations(auth_client: TestClient) -> None:
    assert recommendations(auth_client) == []


def test_search_treats_wildcards_literally(auth_client: TestClient) -> None:
    assert auth_client.get("/api/recipes", params={"q": "_"}).json() == []
    assert auth_client.get("/api/recipes", params={"q": "%"}).json() == []


def omelette(client: TestClient) -> dict | None:
    title = "Spinach & Cheddar Omelette"
    return next((r for r in recommendations(client) if r["recipe"]["title"] == title), None)


def test_optional_and_staple_lines_alone_do_not_recommend(auth_client: TestClient) -> None:
    # The omelette's milk is optional and its salt is a staple.
    stock(auth_client, "milk", "salt")
    assert omelette(auth_client) is None


def test_optional_lines_are_never_missing(auth_client: TestClient) -> None:
    stock(auth_client, "egg", "spinach", "cheddar cheese", "butter")
    rec = omelette(auth_client)

    assert rec is not None
    assert rec["required_count"] == 4
    assert "milk" not in rec["missing"]
    assert "salt" not in rec["missing"]


def test_used_and_discarded_batches_do_not_count(auth_client: TestClient) -> None:
    stock(auth_client, "egg", "spinach", "cheddar cheese", "butter")
    items = {i["ingredient"]["canonical_name"]: i for i in auth_client.get("/api/pantry").json()}
    auth_client.delete(f"/api/pantry/{items['spinach']['id']}")
    auth_client.patch(f"/api/pantry/{items['butter']['id']}", json={"status": "used"})

    rec = omelette(auth_client)

    assert rec is not None
    assert rec["have_count"] == 2
    assert sorted(rec["missing"]) == ["butter", "spinach"]


@pytest.mark.parametrize(
    ("days", "urgent"), [(-2, True), (0, True), (URGENT_DAYS, True), (URGENT_DAYS + 1, False)]
)
def test_urgency_window_boundary(auth_client: TestClient, days: int, urgent: bool) -> None:
    stock(auth_client, "egg", "spinach", "cheddar cheese", "butter", expires_in={"spinach": days})

    rec = omelette(auth_client)

    assert rec is not None
    assert (rec["expiring"] == ["spinach"]) is urgent
    assert rec["score"] == (0.775 if urgent else 0.7)


def test_soonest_batch_decides_urgency(auth_client: TestClient) -> None:
    stock(auth_client, "egg", "cheddar cheese", "butter")
    stock(auth_client, "spinach", expires_in={"spinach": 30})
    stock(auth_client, "spinach", expires_in={"spinach": 1})

    rec = omelette(auth_client)

    assert rec is not None
    assert rec["expiring"] == ["spinach"]
    assert rec["have_count"] == 4  # two batches still count once


def test_partial_coverage_score(auth_client: TestClient) -> None:
    stock(auth_client, "egg", "spinach")

    rec = omelette(auth_client)

    assert rec is not None
    assert rec["coverage"] == 0.5
    assert rec["score"] == 0.35
    assert sorted(rec["missing"]) == ["butter", "cheddar cheese"]


def test_results_are_sorted_by_score(auth_client: TestClient) -> None:
    stock(auth_client, "egg", "spinach", "cheddar cheese", "butter", "milk", "rice", "garlic",
          expires_in={"garlic": 1})  # fmt: skip
    scores = [r["score"] for r in recommendations(auth_client)]

    assert scores == sorted(scores, reverse=True)
    assert len(scores) > 3


def test_recommendation_limit(auth_client: TestClient) -> None:
    stock(auth_client, "egg", "garlic", "onion", "butter", "rice")

    assert len(recommendations(auth_client, limit=2)) == 2
    assert auth_client.get("/api/recipes/recommendations", params={"limit": 0}).status_code == 422
    assert (
        auth_client.get("/api/recipes/recommendations", params={"max_missing": -1}).status_code
        == 422
    )


def test_avoiding_an_allergen_alone(auth_client: TestClient) -> None:
    stock(auth_client, "peanut butter", "pasta", "soy sauce", "garlic", "rice")
    nuts = tag_id(auth_client, "contains-nuts")

    def has_nuts(rec: dict) -> bool:
        return "contains-nuts" in [t["name"] for t in rec["recipe"]["tags"]]

    assert any(has_nuts(r) for r in recommendations(auth_client))
    auth_client.put("/api/me/diet-prefs", json={"prefs": [{"tag_id": nuts, "mode": "avoid"}]})
    after = recommendations(auth_client)

    assert after
    assert not any(has_nuts(r) for r in after)


def test_requiring_two_tags_needs_both(auth_client: TestClient) -> None:
    stock(auth_client, "rice", "black beans", "onion", "garlic", "tomato", "egg", "butter")
    vegan, gluten_free = tag_id(auth_client, "vegan"), tag_id(auth_client, "gluten-free")
    auth_client.put(
        "/api/me/diet-prefs",
        json={"prefs": [{"tag_id": vegan, "mode": "require"},
                        {"tag_id": gluten_free, "mode": "require"}]},
    )  # fmt: skip

    for rec in recommendations(auth_client):
        tags = {t["name"] for t in rec["recipe"]["tags"]}
        assert {"vegan", "gluten-free"} <= tags


def test_diet_prefs_are_replaced_not_merged(auth_client: TestClient) -> None:
    vegan, nuts = tag_id(auth_client, "vegan"), tag_id(auth_client, "contains-nuts")
    auth_client.put("/api/me/diet-prefs", json={"prefs": [{"tag_id": vegan, "mode": "require"}]})

    saved = auth_client.put(
        "/api/me/diet-prefs", json={"prefs": [{"tag_id": nuts, "mode": "avoid"}]}
    ).json()

    assert [(p["tag"]["name"], p["mode"]) for p in saved] == [("contains-nuts", "avoid")]
    assert auth_client.put("/api/me/diet-prefs", json={"prefs": []}).json() == []
    assert auth_client.get("/api/me/diet-prefs").json() == []


def test_diet_prefs_are_per_user(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    join_household(ben, ana)
    vegan = tag_id(ana, "vegan")
    ana.put("/api/me/diet-prefs", json={"prefs": [{"tag_id": vegan, "mode": "require"}]})

    assert ben.get("/api/me/diet-prefs").json() == []


def test_diet_pref_mode_is_validated(auth_client: TestClient) -> None:
    vegan = tag_id(auth_client, "vegan")
    response = auth_client.put(
        "/api/me/diet-prefs", json={"prefs": [{"tag_id": vegan, "mode": "prefer"}]}
    )
    assert response.status_code == 422


def test_dietary_tags_have_kinds(auth_client: TestClient) -> None:
    tags = {t["name"]: t["kind"] for t in auth_client.get("/api/dietary-tags").json()}
    assert tags["vegan"] == "diet"
    assert tags["contains-nuts"] == "allergen"


def test_recipe_list_paginates(auth_client: TestClient) -> None:
    first = auth_client.get("/api/recipes", params={"limit": 5}).json()
    second = auth_client.get("/api/recipes", params={"limit": 5, "offset": 5}).json()

    assert len(first) == len(second) == 5
    assert not {r["id"] for r in first} & {r["id"] for r in second}
    titles = [r["title"] for r in first + second]
    assert titles == sorted(titles)


def test_recipe_routes_require_session(client: TestClient) -> None:
    assert client.get("/api/recipes/recommendations").status_code == 401
    assert client.get("/api/recipes/1").status_code == 401
    assert client.get("/api/me/diet-prefs").status_code == 401
