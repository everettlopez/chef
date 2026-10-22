from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.services.ingredients import Resolver, convert, parse_line


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
