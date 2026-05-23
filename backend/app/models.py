from datetime import date, datetime, time
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class FieldModel(BaseModel):
    """Sports field as returned by the API."""

    id: str
    name: str
    sport: list[str]
    address: str
    lat: float
    lng: float
    available: bool = True
    surface: str = ""  # grass | artificial | concrete | clay | hardcourt
    is_indoor: bool = False
    phone: Optional[str] = None
    website: Optional[str] = None

    model_config = {"from_attributes": True}


class GameModel(BaseModel):
    """Game announcement as returned by the API."""

    id: str
    field_id: str
    field_name: str
    sport: str
    date: str  # ISO date string
    time: str  # HH:MM
    players_needed: int = Field(gt=0)
    players_joined: int = Field(ge=0, default=0)
    author: str
    description: Optional[str] = None
    created_at: str  # ISO datetime string

    model_config = {"from_attributes": True}


class GameCreate(BaseModel):
    """Request body for POST /games."""

    field_id: str
    field_name: str
    sport: str
    date: str = Field(description="ISO date (YYYY-MM-DD)")
    time: str = Field(description="Time (HH:MM)", pattern=r"^\d{2}:\d{2}$")
    players_needed: int = Field(gt=0, le=100)
    author: str = Field(min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)


class FieldsResponse(BaseModel):
    """Paginated list of fields."""

    fields: list[FieldModel]
    total: int


class GamesResponse(BaseModel):
    """Paginated list of game announcements."""

    games: list[GameModel]
    total: int
