from tests.conftest import SignUp


def test_join_with_invite_code_shares_pantry(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    code = ana.get("/api/household").json()["invite_code"]

    ana.post("/api/pantry", json={"name": "milk", "quantity": 1, "storage": "fridge"})

    joined = ben.post("/api/household/join", json={"invite_code": code.lower()})
    assert joined.status_code == 200
    assert sorted(m["display_name"] for m in joined.json()["members"]) == ["Ana", "Ben"]

    ben_pantry = ben.get("/api/pantry").json()
    assert [item["ingredient"]["canonical_name"] for item in ben_pantry] == ["milk"]


def test_unknown_invite_code_is_404(auth_client) -> None:
    response = auth_client.post("/api/household/join", json={"invite_code": "ZZZZZZZZ"})
    assert response.status_code == 404


def test_households_are_isolated(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    item = ana.post("/api/pantry", json={"name": "rice", "quantity": 2, "unit": "cup"}).json()

    assert ben.get("/api/pantry").json() == []
    assert ben.patch(f"/api/pantry/{item['id']}", json={"quantity": 1}).status_code == 404
    assert ben.delete(f"/api/pantry/{item['id']}").status_code == 404


def test_rename_and_regenerate_code(auth_client) -> None:
    before = auth_client.get("/api/household").json()

    renamed = auth_client.patch("/api/household", json={"name": "Apartment 4B"}).json()
    regenerated = auth_client.post("/api/household/invite-code").json()

    assert renamed["name"] == "Apartment 4B"
    assert regenerated["invite_code"] != before["invite_code"]
