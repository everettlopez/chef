"""chef mvp schema

Replaces the skeleton pantry_items table (no real data yet) with the Design Doc v2.0 schema:
users and households, canonical ingredients, recipes and tags, diet prefs, and cook logs.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-22

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("pantry_items")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "households",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("invite_code", sa.String(length=16), nullable=False, unique=True),
    )
    op.create_table(
        "household_members",
        sa.Column(
            "household_id",
            sa.Integer(),
            sa.ForeignKey("households.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
            unique=True,
        ),
        sa.Column("role", sa.String(length=16), nullable=False),
    )

    op.create_table(
        "ingredients",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("canonical_name", sa.String(length=120), nullable=False, unique=True),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("default_unit", sa.String(length=32), nullable=True),
        sa.Column("shelf_days_pantry", sa.Integer(), nullable=True),
        sa.Column("shelf_days_fridge", sa.Integer(), nullable=True),
        sa.Column("shelf_days_freezer", sa.Integer(), nullable=True),
    )
    op.create_table(
        "ingredient_aliases",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "ingredient_id",
            sa.Integer(),
            sa.ForeignKey("ingredients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("alias", sa.String(length=120), nullable=False, unique=True),
        sa.Column("source", sa.String(length=32), nullable=False),
    )

    op.create_table(
        "pantry_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "household_id",
            sa.Integer(),
            sa.ForeignKey("households.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("ingredient_id", sa.Integer(), sa.ForeignKey("ingredients.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=True),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("storage", sa.String(length=16), nullable=False),
        sa.Column("purchased_on", sa.Date(), nullable=False),
        sa.Column("expires_on", sa.Date(), nullable=True),
        sa.Column("expiry_estimated", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, index=True),
        sa.Column(
            "added_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "dietary_tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=40), nullable=False, unique=True),
        sa.Column("kind", sa.String(length=16), nullable=False),
    )
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(length=200), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("prep_min", sa.Integer(), nullable=True),
        sa.Column("cook_min", sa.Integer(), nullable=True),
        sa.Column("servings", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=True, unique=True),
    )
    op.create_table(
        "recipe_ingredients",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "recipe_id",
            sa.Integer(),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "ingredient_id",
            sa.Integer(),
            sa.ForeignKey("ingredients.id"),
            nullable=True,
            index=True,
        ),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=True),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("raw_text", sa.String(length=255), nullable=False),
        sa.Column("optional", sa.Boolean(), nullable=False),
        sa.Column("match_confidence", sa.Double(), nullable=True),
        sa.Column("match_method", sa.String(length=16), nullable=True),
    )
    op.create_table(
        "recipe_tags",
        sa.Column(
            "recipe_id",
            sa.Integer(),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            sa.Integer(),
            sa.ForeignKey("dietary_tags.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "user_diet_prefs",
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "tag_id",
            sa.Integer(),
            sa.ForeignKey("dietary_tags.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("mode", sa.String(length=16), nullable=False),
    )

    op.create_table(
        "cook_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column(
            "household_id",
            sa.Integer(),
            sa.ForeignKey("households.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id"), nullable=False),
        sa.Column("servings_made", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("cooked_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "pantry_usages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "cook_log_id",
            sa.Integer(),
            sa.ForeignKey("cook_logs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "pantry_item_id",
            sa.Integer(),
            sa.ForeignKey("pantry_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity_used", sa.Numeric(10, 2), nullable=True),
        sa.Column("previous_status", sa.String(length=16), nullable=False),
    )


def downgrade() -> None:
    for table in (
        "pantry_usages",
        "cook_logs",
        "user_diet_prefs",
        "recipe_tags",
        "recipe_ingredients",
        "recipes",
        "dietary_tags",
        "pantry_items",
        "ingredient_aliases",
        "ingredients",
        "household_members",
        "households",
        "users",
    ):
        op.drop_table(table)

    # Restore the 0001 skeleton table.
    op.create_table(
        "pantry_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
