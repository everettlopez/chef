from tests.conftest import SignUp, join_household


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


def test_owner_leaving_hands_ownership_to_remaining_member(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    cy = sign_up("cy@example.com", "Cy")
    ana_code = ana.get("/api/household").json()["invite_code"]
    ben.post("/api/household/join", json={"invite_code": ana_code})

    # Ana (the owner) moves to Cy's household; Ben stays behind and becomes owner.
    cy_code = cy.get("/api/household").json()["invite_code"]
    ana.post("/api/household/join", json={"invite_code": cy_code})

    left_behind = ben.get("/api/household").json()
    assert [(m["display_name"], m["role"]) for m in left_behind["members"]] == [("Ben", "owner")]
    assert left_behind["invite_code"] == ana_code


def test_leaving_an_empty_household_deletes_it(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    ben.post("/api/pantry", json={"name": "rice"})
    ben_code = ben.get("/api/household").json()["invite_code"]

    ben.post(
        "/api/household/join", json={"invite_code": ana.get("/api/household").json()["invite_code"]}
    )

    # Ben's old household (and its pantry) is gone, so its code no longer works.
    assert ana.post("/api/household/join", json={"invite_code": ben_code}).status_code == 404
    assert [i["ingredient"]["canonical_name"] for i in ana.get("/api/pantry").json()] == []


def test_joining_your_own_household_is_a_no_op(auth_client) -> None:
    before = auth_client.get("/api/household").json()

    again = auth_client.post("/api/household/join", json={"invite_code": before["invite_code"]})

    assert again.status_code == 200
    assert again.json() == before


def test_members_list_shows_roles_and_emails(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    join_household(ben, ana)

    members = ana.get("/api/household").json()["members"]

    assert [(m["display_name"], m["email"], m["role"]) for m in members] == [
        ("Ana", "ana@example.com", "owner"),
        ("Ben", "ben@example.com", "member"),
    ]


def test_regenerated_code_retires_the_old_one(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    old_code = ana.get("/api/household").json()["invite_code"]
    new_code = ana.post("/api/household/invite-code").json()["invite_code"]

    assert ben.post("/api/household/join", json={"invite_code": old_code}).status_code == 404
    assert ben.post("/api/household/join", json={"invite_code": new_code}).status_code == 200


def test_invite_codes_avoid_ambiguous_characters(auth_client) -> None:
    url = "/api/household/invite-code"
    codes = {auth_client.post(url).json()["invite_code"] for _ in range(20)}

    for code in codes:
        assert len(code) == 8
        assert not set(code) & set("01IO")
        assert code == code.upper()


def test_invite_code_ignores_surrounding_whitespace(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    code = ana.get("/api/household").json()["invite_code"]

    joined = ben.post("/api/household/join", json={"invite_code": f"  {code.lower()}  "})

    assert joined.status_code == 200


def test_household_input_is_validated(auth_client) -> None:
    assert auth_client.patch("/api/household", json={"name": "   "}).status_code == 422
    assert auth_client.patch("/api/household", json={"name": "x" * 81}).status_code == 422
    assert auth_client.post("/api/household/join", json={"invite_code": "AB"}).status_code == 422


def test_rename_is_visible_to_every_member(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    join_household(ben, ana)

    ben.patch("/api/household", json={"name": "Shared Flat"})

    assert ana.get("/api/household").json()["name"] == "Shared Flat"


def test_joined_member_sees_and_edits_shared_items(sign_up: SignUp) -> None:
    ana = sign_up("ana@example.com", "Ana")
    ben = sign_up("ben@example.com", "Ben")
    join_household(ben, ana)
    item = ana.post("/api/pantry", json={"name": "rice", "quantity": 2, "unit": "cup"}).json()

    assert ben.patch(f"/api/pantry/{item['id']}", json={"quantity": 1}).status_code == 200
    assert ana.get("/api/pantry").json()[0]["quantity"] == 1
