from datetime import date, timedelta

from fastapi.testclient import TestClient

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
