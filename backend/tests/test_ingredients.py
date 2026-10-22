from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.services.errors import InvalidInputError
from app.services.ingredients import (
    Resolver,
    _singular,
    convert,
    get_or_create,
    normalize,
    normalize_unit,
    parse_line,
    search,
)


@pytest.mark.parametrize(
    ("raw", "quantity", "unit", "name", "optional"),
    [
        ("2 cups chopped onion", "2", "cup", "onion", False),
        ("1 (14 oz) can diced tomatoes", "14", "oz", "canned tomatoes", False),
        ("1 1/2 cups all-purpose flour", "1.5", "cup", "all purpose flour", False),
        ("½ tsp red pepper flakes (optional)", "0.5", "tsp", "red pepper flakes", True),
        ("3 cloves garlic, minced", "3", "clove", "garlic", False),
        ("4 eggs", "4", None, "eggs", False),
        ("Salt, to taste", None, None, "salt", True),
    ],
)
def test_parse_line(raw, quantity, unit, name, optional) -> None:
    parsed = parse_line(raw)
    assert parsed.quantity == (Decimal(quantity) if quantity else None)
    assert parsed.unit == unit
    assert parsed.name == name
    assert parsed.optional is optional


@pytest.mark.parametrize(
    ("text", "canonical", "method"),
    [
        ("milk", "milk", "exact"),
        ("Whole Milk", "milk", "exact"),  # alias
        ("bell peppers", "bell pepper", "exact"),  # singular form
        ("canned diced tomatoes", "canned tomatoes", "exact"),
        ("brocoli", "broccoli", "fuzzy"),
        ("parmesian cheese", "parmesan", "fuzzy"),
    ],
)
def test_resolver(db_session: Session, text: str, canonical: str, method: str) -> None:
    match = Resolver(db_session).resolve(text)
    assert match is not None
    assert (match.canonical_name, match.method) == (canonical, method)
    assert 0 < match.confidence <= 1


def test_resolver_rejects_unrelated_text(db_session: Session) -> None:
    assert Resolver(db_session).resolve("motor oil filter") is None


def test_convert() -> None:
    assert convert(Decimal("16"), "tbsp", "cup") == Decimal("1.00")
    assert convert(Decimal("1"), "lb", "oz") == Decimal("16.00")
    assert convert(Decimal("2"), "cup", "cup") == Decimal("2")
    assert convert(Decimal("1"), "cup", "lb") is None
    assert convert(Decimal("1"), None, "cup") is None


@pytest.mark.parametrize(
    ("raw", "quantity", "unit", "name"),
    [
        ("1/2 cup sugar", "0.5", "cup", "sugar"),
        ("¾ cup milk", "0.75", "cup", "milk"),
        ("2.5 lbs. ground beef", "2.5", "lb", "ground beef"),
        ("1 (8 oz) package cream cheese, softened", "8", "oz", "cream cheese"),
        ("2 large onions, finely chopped", "2", None, "onions"),
        ("1 Tablespoon Olive Oil", "1", "tbsp", "olive oil"),
        ("butter (softened)", None, None, "butter"),
        ("2 cups", "2", "cup", ""),
    ],
)
def test_parse_line_more_shapes(raw, quantity, unit, name) -> None:
    parsed = parse_line(raw)
    assert parsed.quantity == (Decimal(quantity) if quantity else None)
    assert (parsed.unit, parsed.name) == (unit, name)


@pytest.mark.parametrize(
    ("text", "expected"),
    [("  Whole   MILK!! ", "whole milk"), ("Mom’s sauce", "mom's sauce"),
     ("50% cream", "50% cream"), ("", ""), ("***", "")],
)  # fmt: skip
def test_normalize(text: str, expected: str) -> None:
    assert normalize(text) == expected


@pytest.mark.parametrize(
    ("unit", "expected"),
    [("Cups", "cup"), ("tbsp.", "tbsp"), (" LBS ", "lb"), ("pinch", "pinch"), ("dash", "pinch"),
     ("handful", "handful"), ("", None), ("   ", None), (None, None)],
)  # fmt: skip
def test_normalize_unit(unit, expected) -> None:
    assert normalize_unit(unit) == expected


@pytest.mark.parametrize(
    ("word", "singular"),
    [("berries", "berry"), ("tomatoes", "tomato"), ("peaches", "peach"), ("radishes", "radish"),
     ("eggs", "egg"), ("swiss", "swiss"), ("rice", "rice")],
)  # fmt: skip
def test_singular(word: str, singular: str) -> None:
    assert _singular(word) == singular


def test_convert_more() -> None:
    assert convert(Decimal("1"), "gallon", "cup") == Decimal("16.00")
    assert convert(Decimal("1000"), "g", "kg") == Decimal("1.00")
    assert convert(Decimal("1"), "Cups", "cup") == Decimal("1")  # normalized before comparing
    assert convert(Decimal("1"), "clove", "g") is None
    assert convert(Decimal("1"), None, None) == Decimal("1")


def test_resolver_ignores_blank_text(db_session: Session) -> None:
    assert Resolver(db_session).resolve("  ...  ") is None


def test_resolver_add_extends_vocabulary(db_session: Session) -> None:
    resolver = Resolver(db_session)
    milk = resolver.resolve("milk")
    assert milk is not None

    resolver.add("moo juice", milk.ingredient_id, "milk")

    match = resolver.resolve("Moo Juice")
    assert match is not None
    assert (match.canonical_name, match.method) == ("milk", "exact")


def test_search_ranks_prefix_before_substring(db_session: Session) -> None:
    names = [i.canonical_name for i in search(db_session, "cheese", limit=20)]

    assert names, "seed has cheeses"
    prefix = [n for n in names if n.startswith("cheese")]
    assert names[: len(prefix)] == prefix
    assert len(search(db_session, "c", limit=3)) == 3
    assert search(db_session, "!!!") == []


def test_get_or_create(db_session: Session) -> None:
    existing, match = get_or_create(db_session, "Whole Milk")
    assert existing.canonical_name == "milk"
    assert match is not None

    created, none = get_or_create(db_session, "Zzyzx Root")
    assert (created.canonical_name, created.category, none) == ("zzyzx root", "other", None)
    assert [a.source for a in created.aliases] == ["user"]

    with pytest.raises(InvalidInputError):
        get_or_create(db_session, "???")
