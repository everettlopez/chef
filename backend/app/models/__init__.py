# Import every model here so Base.metadata sees it (Alembic autogenerate, tests).
from app.models.pantry_item import PantryItem

__all__ = ["PantryItem"]
