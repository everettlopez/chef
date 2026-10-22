"""Shared ingredient resolver: messy text -> canonical INGREDIENTS row.

Used by the API (pantry autocomplete and free-text adds), the seed script and the offline
pipelines, so matching behaves the same everywhere. Resolution order: exact alias or
canonical name, then the singular form, then rapidfuzz fuzzy matching above a threshold.
"""

import re
from dataclasses import dataclass
from decimal import Decimal
from fractions import Fraction

from rapidfuzz import fuzz, process
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Ingredient, IngredientAlias

FUZZY_THRESHOLD = 85

_UNITS = {
    "cup": "cup", "cups": "cup", "c": "cup",
    "tbsp": "tbsp", "tablespoon": "tbsp", "tablespoons": "tbsp", "tbs": "tbsp",
    "tsp": "tsp", "teaspoon": "tsp", "teaspoons": "tsp",
    "oz": "oz", "ounce": "oz", "ounces": "oz",
    "lb": "lb", "lbs": "lb", "pound": "lb", "pounds": "lb",
    "g": "g", "gram": "g", "grams": "g",
    "kg": "kg", "kilogram": "kg", "kilograms": "kg",
    "ml": "ml", "milliliter": "ml", "milliliters": "ml",
    "l": "l", "liter": "l", "liters": "l", "litre": "l", "litres": "l",
    "gal": "gallon", "gallon": "gallon", "gallons": "gallon",
    "qt": "quart", "quart": "quart", "quarts": "quart",
    "pt": "pint", "pint": "pint", "pints": "pint",
    "clove": "clove", "cloves": "clove",
    "can": "can", "cans": "can",
    "slice": "slice", "slices": "slice",
    "pinch": "pinch", "dash": "pinch",
    "bunch": "bunch", "bunches": "bunch",
    "head": "head", "heads": "head",
    "stalk": "stalk", "stalks": "stalk",
    "package": "package", "packages": "package", "pkg": "package",
    "dozen": "dozen",
}  # fmt: skip

# Conversion factors to a base unit (ml for volume, g for mass).
_VOLUME = {"tsp": 4.929, "tbsp": 14.787, "cup": 236.6, "ml": 1, "l": 1000, "pint": 473.2,
           "quart": 946.4, "gallon": 3785.4}  # fmt: skip
_MASS = {"g": 1, "kg": 1000, "oz": 28.35, "lb": 453.6}

# Words that describe preparation rather than identity ("2 cups chopped onion" -> onion).
_DESCRIPTORS = {
    "chopped", "diced", "minced", "sliced", "grated", "shredded", "crushed", "fresh",
    "freshly", "large", "small", "medium", "finely", "roughly", "thinly",
    "peeled", "cooked", "uncooked", "boneless", "skinless", "softened", "melted", "cubed",
    "halved", "quartered", "packed", "divided", "beaten", "rinsed", "drained", "whole",
    "a", "of", "about", "to", "taste", "for", "serving", "optional", "plus", "more",
    "ripe", "rolled", "dry", "dried", "extra", "firm", "plain", "unsalted", "salted", "low",
    "sodium", "trimmed", "juiced", "zested", "crumbled", "deveined", "thawed", "leftover",
    "leaves", "leaf",
}  # fmt: skip

_UNICODE_FRACTIONS = {"½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅛": "1/8"}
_QTY = r"\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?"


@dataclass(frozen=True)
class Match:
    ingredient_id: int
    canonical_name: str
    confidence: float
    method: str  # "exact" | "fuzzy"


@dataclass(frozen=True)
class ParsedLine:
    quantity: Decimal | None
    unit: str | None
    name: str
    optional: bool


def normalize(text: str) -> str:
    text = text.lower().replace("’", "'")
    text = re.sub(r"[^a-z0-9%'/ ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_unit(unit: str | None) -> str | None:
    if unit is None or not unit.strip():
        return None
    key = unit.strip().lower().rstrip(".")
    return _UNITS.get(key, key)


def convert(quantity: Decimal, from_unit: str | None, to_unit: str | None) -> Decimal | None:
    """Convert between common units; None if they aren't compatible."""
    a, b = normalize_unit(from_unit), normalize_unit(to_unit)
    if a == b:
        return quantity
    for table in (_VOLUME, _MASS):
        if a in table and b in table:
            return (quantity * Decimal(str(table[a])) / Decimal(str(table[b]))).quantize(
                Decimal("0.01")
            )
    return None


def _parse_quantity(text: str) -> Decimal:
    return Decimal(str(float(sum(Fraction(part) for part in text.split()))))


def parse_line(raw: str) -> ParsedLine:
    """Split a recipe or receipt line into quantity, unit and ingredient name."""
    text = raw.strip()
    for symbol, ascii_fraction in _UNICODE_FRACTIONS.items():
        text = text.replace(symbol, f" {ascii_fraction}")
    lowered = text.lower()
    optional = "optional" in lowered or "to taste" in lowered or "for serving" in lowered

    quantity: Decimal | None = None
    unit: str | None = None
    match = re.match(rf"^\s*({_QTY})\s*(.*)$", text)
    if match:
        quantity = _parse_quantity(match.group(1))
        text = match.group(2)
        # "1 (14 oz) can tomatoes": the parenthetical is the useful amount.
        paren = re.match(rf"^\(\s*({_QTY})\s*([a-zA-Z]+)\.?\s*\)\s*(.*)$", text)
        if paren and normalize_unit(paren.group(2)) in _UNITS.values():
            quantity = quantity * _parse_quantity(paren.group(1))
            unit = normalize_unit(paren.group(2))
            text = paren.group(3)
            first, _, rest = text.partition(" ")
            if normalize_unit(first) == "can":
                text = f"canned {rest}"
            elif normalize_unit(first) == "package":
                text = rest

    if unit is None:
        first, _, rest = text.strip().partition(" ")
        if quantity is not None and first.lower().rstrip(".") in _UNITS:
            unit = normalize_unit(first)
            text = rest

    # Drop anything after a comma or parenthesis ("onion, chopped", "butter (softened)").
    text = re.split(r"[,(]", text, maxsplit=1)[0]
    words = [w for w in normalize(text).split() if w not in _DESCRIPTORS]
    return ParsedLine(quantity=quantity, unit=unit, name=" ".join(words), optional=optional)


def _singular(name: str) -> str:
    if name.endswith("ies"):
        return name[:-3] + "y"
    if name.endswith(("oes", "ches", "shes")):
        return name[:-2]
    if name.endswith("s") and not name.endswith("ss"):
        return name[:-1]
    return name


class Resolver:
    """Loads the vocabulary once; reuse one instance for bulk matching."""

    def __init__(self, db: Session) -> None:
        self._names: dict[str, tuple[int, str]] = {}
        for ingredient in db.scalars(select(Ingredient)):
            self._names[ingredient.canonical_name] = (ingredient.id, ingredient.canonical_name)
        rows = db.execute(
            select(IngredientAlias.alias, Ingredient.id, Ingredient.canonical_name).join(Ingredient)
        )
        for alias, ingredient_id, canonical in rows:
            self._names[normalize(alias)] = (ingredient_id, canonical)
        self._choices = list(self._names)

    def add(self, name: str, ingredient_id: int, canonical_name: str) -> None:
        key = normalize(name)
        if key not in self._names:
            self._names[key] = (ingredient_id, canonical_name)
            self._choices.append(key)

    def resolve(self, text: str) -> Match | None:
        name = normalize(text)
        if not name:
            return None
        for candidate in (name, _singular(name)):
            if candidate in self._names:
                ingredient_id, canonical = self._names[candidate]
                return Match(ingredient_id, canonical, 1.0, "exact")

        best = process.extractOne(
            name, self._choices, scorer=fuzz.token_sort_ratio, score_cutoff=FUZZY_THRESHOLD
        )
        if best is None:
            return None
        ingredient_id, canonical = self._names[best[0]]
        return Match(ingredient_id, canonical, round(best[1] / 100, 3), "fuzzy")


def resolve(db: Session, text: str) -> Match | None:
    return Resolver(db).resolve(text)


def search(db: Session, query: str, limit: int = 8) -> list[Ingredient]:
    """Autocomplete: prefix matches first, then substring, then fuzzy."""
    q = normalize(query)
    if not q:
        return []

    results: list[Ingredient] = []
    seen: set[int] = set()

    def collect(ingredients) -> None:
        for ingredient in ingredients:
            if ingredient.id not in seen and len(results) < limit:
                seen.add(ingredient.id)
                results.append(ingredient)

    for pattern in (f"{q}%", f"%{q}%"):
        collect(
            db.scalars(
                select(Ingredient)
                .outerjoin(IngredientAlias)
                .where(
                    or_(
                        Ingredient.canonical_name.like(pattern),
                        IngredientAlias.alias.like(pattern),
                    )
                )
                .order_by(Ingredient.canonical_name)
                .limit(limit * 2)
            ).unique()
        )

    if len(results) < limit:
        match = resolve(db, q)
        if match is not None:
            collect([db.get(Ingredient, match.ingredient_id)])
    return results


def get_or_create(db: Session, name: str) -> tuple[Ingredient, Match | None]:
    """Resolve free text, or add it as a new user-created ingredient. Caller commits."""
    match = resolve(db, name)
    if match is not None:
        ingredient = db.get(Ingredient, match.ingredient_id)
        assert ingredient is not None
        return ingredient, match

    canonical = normalize(name)
    ingredient = Ingredient(canonical_name=canonical, category="other")
    ingredient.aliases.append(IngredientAlias(alias=canonical, source="user"))
    db.add(ingredient)
    db.flush()
    return ingredient, None
